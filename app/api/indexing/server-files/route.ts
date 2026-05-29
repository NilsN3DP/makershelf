import { promises as fs } from "node:fs";
import { FileSource } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { detectFileType, humanFileSize, type PrintFile } from "@/src/lib/makershelf-data";
import {
  removeImportedSourceDirectories,
  removeImportedSourceFiles,
  resolveImportPath,
} from "@/src/lib/server/import-root";
import { writeStoredFile } from "@/src/lib/server/file-storage";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const serverImportEntrySchema = z.object({
  sourcePath: z.string().min(1),
  name: z.string().min(1),
  originalName: z.string().min(1),
  type: z.string().min(1).optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  storedPath: z.string().min(1),
  originalPath: z.string().optional(),
  folderPath: z.string().optional(),
  notes: z.string().default(""),
  source: z.enum(["indexing"]).default("indexing"),
});

const serverImportSchema = z.object({
  projectId: z.string().min(1),
  manifest: z.array(serverImportEntrySchema).min(1),
  cleanupRootPaths: z.array(z.string().min(1)).default([]),
});

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
  const sizeBytes = Number(file.sizeBytes);
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    type: detectFileType(file.name),
    sizeBytes,
    sizeLabel: humanFileSize(sizeBytes),
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

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceAccess();
    if (!access.ok) {
      return access.response;
    }

    if (access.permissions.isReadOnly || !access.permissions.canUpload) {
      return NextResponse.json({ error: "Keine Upload-Berechtigung." }, { status: 403 });
    }

    const body = serverImportSchema.parse(await request.json());
    const project = await prisma.project.findFirst({
      where: {
        id: body.projectId,
        workspaceId: access.membership.workspaceId,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
    }

    const createdFiles: PrintFile[] = [];
    for (const entry of body.manifest) {
      const sourceAbsolutePath = resolveImportPath(entry.sourcePath);
      const buffer = await fs.readFile(sourceAbsolutePath);
      const stats = await fs.stat(sourceAbsolutePath);

      await writeStoredFile(
        {
          storedPath: entry.storedPath,
          preferRuntimeRoot: true,
        },
        buffer,
      );

      const created = await prisma.projectFile.create({
        data: {
          projectId: body.projectId,
          name: entry.name,
          originalName: entry.originalName,
          type: entry.type || detectFileType(entry.name),
          mimeType: entry.mimeType || null,
          sizeBytes: BigInt(entry.sizeBytes ?? stats.size),
          storedPath: entry.storedPath,
          originalPath: entry.originalPath || null,
          folderPath: entry.folderPath || null,
          notes: entry.notes,
          source: FileSource.INDEXING,
          extractedFromZip: null,
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

    const fileCleanup = await removeImportedSourceFiles(body.manifest.map((entry) => entry.sourcePath));
    const directoryCleanup = body.cleanupRootPaths.length
      ? await removeImportedSourceDirectories(body.cleanupRootPaths)
      : { deletedDirectories: [], cleanupErrors: [] };

    return NextResponse.json({
      files: createdFiles,
      cleanup: {
        deleted: fileCleanup.deleted,
        deletedDirectories: directoryCleanup.deletedDirectories,
        cleanupErrors: [...fileCleanup.cleanupErrors, ...directoryCleanup.cleanupErrors],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Importmanifest ist unvollständig oder ungültig.", issues: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Server-Dateiimport fehlgeschlagen: ${error.message}`
            : "Server-Dateiimport fehlgeschlagen.",
      },
      { status: 500 },
    );
  }
}
