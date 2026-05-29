import { FileSource, ProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  detectFileType,
  getFolderPath,
  isSupportedArchiveFile,
  isSupportedPrintFile,
  slugify,
} from "@/src/lib/makershelf-data";
import { getProjectFileStorageRelativePath } from "@/src/lib/project-file-storage-core";
import { buildProjectStorageBasePath } from "@/src/lib/project-info";
import { createGuestToken } from "@/src/lib/server/guest-links";
import { getActiveGuestSubmissionLink } from "@/src/lib/server/guest-submission-links";
import { writeStoredFile } from "@/src/lib/server/file-storage";
import { prisma } from "@/src/lib/server/prisma";

const submissionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(""),
  author: z.string().trim().max(160).default("Gast"),
  license: z.string().trim().min(1).max(120).default("Unknown"),
  sourceUrl: z.string().trim().max(500).default(""),
  tags: z.string().trim().max(500).default(""),
});

function buildGuestProjectUrl(request: NextRequest, token: string) {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/guest/${token}`;
}

async function createUniqueProjectSlug(workspaceId: string, title: string) {
  const baseSlug = slugify(title) || "gast-projekt";
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.project.findFirst({ where: { workspaceId, slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function isAllowedGuestFile(file: File) {
  return isSupportedPrintFile(file.name) || isSupportedArchiveFile(file.name);
}

function cleanGuestFilename(name: string) {
  return name.replace(/\\/g, "/").replace(/^\/+/g, "").split("/").filter(Boolean).join("/") || "upload.stl";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const link = await getActiveGuestSubmissionLink(token);

  if (!link) {
    return NextResponse.json({ error: "Dieser Gast-Erstellungslink ist nicht mehr gültig." }, { status: 404 });
  }

  const formData = await request.formData();
  const body = submissionSchema.parse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    author: formData.get("author") ?? "Gast",
    license: formData.get("license") ?? "Unknown",
    sourceUrl: formData.get("sourceUrl") ?? "",
    tags: formData.get("tags") ?? "",
  });
  const uploadedFiles = formData.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  const unsupportedFiles = uploadedFiles.filter((file) => !isAllowedGuestFile(file));

  if (unsupportedFiles.length > 0) {
    return NextResponse.json(
      { error: `Nicht unterstützte Datei: ${unsupportedFiles[0].name}` },
      { status: 400 },
    );
  }

  const createdStoredPaths: string[] = [];
  const projectSlug = await createUniqueProjectSlug(link.workspaceId, body.title);
  const project = await prisma.project.create({
    data: {
      workspaceId: link.workspaceId,
      title: body.title,
      slug: projectSlug,
      description: body.description,
      author: body.author || "Gast",
      license: body.license,
      sourceUrl: body.sourceUrl || null,
      sourcePlatform: body.sourceUrl || null,
      coverImage: null,
      coverLabel: body.title.slice(0, 8).toUpperCase(),
      coverGradient: "",
      categoryId: null,
      creatorId: null,
      creatorFolderId: null,
      favorite: false,
      metadataJson: {
        createdByName: "Gast",
        guestSubmission: true,
        guestSubmissionLinkId: link.id,
      },
      status: ProjectStatus.PLANNED,
      tags: parseTags(body.tags),
      lockedFields: [],
    },
  });

  try {
    const basePath = buildProjectStorageBasePath(
      { title: project.title, creatorId: undefined, creatorFolderId: undefined },
      [],
    );
    let thumbnailFileId: string | null = null;

    for (const browserFile of uploadedFiles) {
      const originalPath = cleanGuestFilename(browserFile.name);
      const fileName = originalPath.split("/").at(-1) || browserFile.name;
      const fileType = detectFileType(fileName);
      const storageRelativePath = getProjectFileStorageRelativePath(fileType, originalPath);
      const storedPath = `${basePath}/${storageRelativePath}`;
      const buffer = Buffer.from(await browserFile.arrayBuffer());

      await writeStoredFile({ storedPath, preferRuntimeRoot: true }, buffer);
      createdStoredPaths.push(storedPath);

      const createdFile = await prisma.projectFile.create({
        data: {
          projectId: project.id,
          name: fileName,
          originalName: fileName,
          type: fileType,
          mimeType: browserFile.type || null,
          sizeBytes: BigInt(browserFile.size),
          storedPath,
          originalPath,
          folderPath: getFolderPath(storageRelativePath) || null,
          notes: "",
          source: FileSource.UPLOAD,
          extractedFromZip: null,
        },
      });

      if (!thumbnailFileId && fileType !== "PDF") {
        thumbnailFileId = createdFile.id;
      }
    }

    if (thumbnailFileId) {
      await prisma.project.update({
        where: { id: project.id },
        data: { thumbnailFileId },
      });
    }

    const projectGuestLink = await prisma.projectGuestLink.create({
      data: {
        projectId: project.id,
        token: createGuestToken(),
        label: "Gastansicht",
      },
    });

    return NextResponse.json({
      projectId: project.id,
      guestUrl: buildGuestProjectUrl(request, projectGuestLink.token),
      fileCount: uploadedFiles.length,
    }, { status: 201 });
  } catch (error) {
    await prisma.project.delete({ where: { id: project.id } }).catch(() => undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gast-Projekt konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
