import { FileSource } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  detectFileType,
  humanFileSize,
  type PrintFile,
} from "@/src/lib/makershelf-data";
import {
  deleteStoredFileFromDisk,
  moveStoredFileOnDisk,
  readStoredFile,
  writeStoredFile,
} from "@/src/lib/server/file-storage";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const manifestEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  originalName: z.string().min(1),
  type: z.string().min(1).optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  storedPath: z.string().min(1),
  originalPath: z.string().optional(),
  folderPath: z.string().optional(),
  notes: z.string().default(""),
  source: z.enum(["upload", "zip", "website", "indexing"]),
  extractedFromZip: z.string().optional(),
});

const deleteSchema = z.object({
  fileIds: z.array(z.string()).default([]),
  storedPaths: z.array(z.string()).default([]),
});

const moveSchema = z.object({
  moves: z
    .array(
      z.object({
        fileId: z.string().optional(),
        oldStoredPath: z.string().min(1),
        newStoredPath: z.string().min(1),
      }),
    )
    .min(1),
});

function mapSource(value: z.infer<typeof manifestEntrySchema>["source"]) {
  const sourceMap: Record<z.infer<typeof manifestEntrySchema>["source"], FileSource> = {
    upload: FileSource.UPLOAD,
    zip: FileSource.ZIP,
    website: FileSource.WEBSITE,
    indexing: FileSource.INDEXING,
  };

  return sourceMap[value];
}

function mapPrismaFileToClient(file: {
  id: string;
  name: string;
  originalName: string;
  type: string;
  mimeType: string | null;
  sizeBytes: bigint;
  storedPath: string;
  originalPath: string | null;
  folderPath: string | null;
  notes: string;
  extractedFromZip: string | null;
  uploadedAt: Date;
  source: FileSource;
}): PrintFile {
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    type: detectFileType(file.name),
    sizeBytes: Number(file.sizeBytes),
    sizeLabel: humanFileSize(Number(file.sizeBytes)),
    mimeType: file.mimeType ?? undefined,
    originalPath: file.originalPath ?? undefined,
    folderPath: file.folderPath ?? undefined,
    storedPath: file.storedPath,
    notes: file.notes,
    source: file.source.toLowerCase() as PrintFile["source"],
    uploadedAt: file.uploadedAt.toISOString(),
    extractedFromZip: file.extractedFromZip ?? undefined,
  };
}

function getContentDisposition(fileName: string, download: boolean) {
  const encoded = encodeURIComponent(fileName);
  return `${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const manifestRaw = formData.get("manifest");
    const projectId = String(formData.get("projectId") || "").trim();

    if (!manifestRaw || typeof manifestRaw !== "string") {
      return NextResponse.json({ error: "Upload-Metadaten fehlen." }, { status: 400 });
    }

    const manifest = z.array(manifestEntrySchema).parse(JSON.parse(manifestRaw));
    const uploadedFiles = formData.getAll("files").filter((file): file is File => file instanceof File);

    if (manifest.length === 0 || uploadedFiles.length === 0 || manifest.length !== uploadedFiles.length) {
      return NextResponse.json({ error: "Upload-Daten sind unvollständig." }, { status: 400 });
    }

    const access = await requireWorkspaceAccess();
    if (!access.ok) {
      return access.response;
    }

    if (access.permissions.isReadOnly || !access.permissions.canUpload) {
      return NextResponse.json({ error: "Keine Upload-Berechtigung." }, { status: 403 });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId: access.membership.workspaceId,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
    }

    const createdFiles: PrintFile[] = [];

    for (const [index, browserFile] of uploadedFiles.entries()) {
      const manifestEntry = manifest[index];
      const buffer = Buffer.from(await browserFile.arrayBuffer());

      await writeStoredFile(
        {
          storedPath: manifestEntry.storedPath,
          preferRuntimeRoot: true,
        },
        buffer,
      );

      const created = await prisma.projectFile.create({
        data: {
          projectId,
          name: manifestEntry.name,
          originalName: manifestEntry.originalName,
          type: manifestEntry.type || detectFileType(manifestEntry.name),
          mimeType: manifestEntry.mimeType || browserFile.type || null,
          sizeBytes: BigInt(manifestEntry.sizeBytes ?? browserFile.size),
          storedPath: manifestEntry.storedPath,
          originalPath: manifestEntry.originalPath || null,
          folderPath: manifestEntry.folderPath || null,
          notes: manifestEntry.notes,
          source: mapSource(manifestEntry.source),
          extractedFromZip: manifestEntry.extractedFromZip || null,
        },
      });

      createdFiles.push(mapPrismaFileToClient(created));
    }

    if (!project.thumbnailFileId && createdFiles[0]?.id) {
      await prisma.project.update({
        where: { id: project.id },
        data: { thumbnailFileId: createdFiles[0].id },
      });
    }

    return NextResponse.json({ files: createdFiles });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Dateien konnten nicht gespeichert werden.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId")?.trim();
    const download = searchParams.get("download") === "1";

    const access = await requireWorkspaceAccess();
    if (!access.ok) {
      return access.response;
    }

    if (!fileId) {
      return NextResponse.json(
        { error: "Datei-ID fehlt. Server-Dateien werden aus Sicherheitsgruenden nur per Datei-ID geladen." },
        { status: 400 },
      );
    }

    const file = await prisma.projectFile.findFirst({
      where: {
        id: fileId,
        project: {
          workspaceId: access.membership.workspaceId,
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
    }

    const buffer = await readStoredFile({
      storedPath: file.storedPath,
      preferRuntimeRoot: true,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": getContentDisposition(file.name, download),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Datei konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = deleteSchema.parse(await request.json());

    if (body.fileIds.length === 0) {
      return NextResponse.json({ error: "Keine Datei-IDs angegeben." }, { status: 400 });
    }

    const access = await requireWorkspaceAccess();
    if (!access.ok) {
      return access.response;
    }

    if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const files = await prisma.projectFile.findMany({
      where: {
        id: { in: body.fileIds },
        project: {
          workspaceId: access.membership.workspaceId,
        },
      },
    });

    await Promise.all(
      files.map((file) =>
        deleteStoredFileFromDisk({
          storedPath: file.storedPath,
          preferRuntimeRoot: true,
        }),
      ),
    );

    await prisma.printedFileState.deleteMany({
      where: {
        projectFileId: {
          in: files.map((file) => file.id),
        },
      },
    });

    await prisma.projectFile.deleteMany({
      where: {
        id: {
          in: files.map((file) => file.id),
        },
      },
    });

    return NextResponse.json({ ok: true, deleted: files.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Datei konnte nicht entfernt werden.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = moveSchema.parse(await request.json());

    const access = await requireWorkspaceAccess();
    if (!access.ok) {
      return access.response;
    }

    if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const fileIds = body.moves
      .map((move) => move.fileId)
      .filter((value): value is string => Boolean(value));

    const files = await prisma.projectFile.findMany({
      where: {
        id: { in: fileIds },
        project: {
          workspaceId: access.membership.workspaceId,
        },
      },
    });

    const filesById = new Map(files.map((file) => [file.id, file]));

    for (const move of body.moves) {
      if (!move.fileId) {
        continue;
      }

      const file = filesById.get(move.fileId);
      if (!file) {
        return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
      }

      await moveStoredFileOnDisk(
        {
          storedPath: file.storedPath,
          preferRuntimeRoot: true,
        },
        {
          storedPath: move.newStoredPath,
          preferRuntimeRoot: true,
        },
      );

      await prisma.projectFile.update({
        where: { id: file.id },
        data: { storedPath: move.newStoredPath },
      });
    }

    return NextResponse.json({ ok: true, moved: body.moves.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Dateien konnten nicht verschoben werden.",
      },
      { status: 500 },
    );
  }
}
