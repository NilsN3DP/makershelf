import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { readStoredFile } from "@/src/lib/server/file-storage";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

const allowedTypes = new Set(["STL", "3MF", "OBJ", "AMF"]);

function safeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 90) || "untitled";
}

function resolveImportRoot() {
  const configured = getRuntimeConfig().prusaSlicerImportRoot?.trim() || "/import/prusaslicer";
  return path.resolve(configured);
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as { fileId?: string };
  if (!body.fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  const file = await prisma.projectFile.findFirst({
    where: {
      id: body.fileId,
      project: {
        workspaceId: access.membership.workspaceId,
      },
    },
    include: {
      project: {
        select: {
          title: true,
          sourceUrl: true,
          license: true,
          author: true,
        },
      },
    },
  });

  if (!file) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: `Dateityp ${file.type} ist fuer den PrusaSlicer-Docker-Import noch nicht freigegeben.` },
      { status: 400 },
    );
  }

  const importRoot = resolveImportRoot();
  const projectFolder = safeSegment(file.project.title);
  const targetDirectory = path.resolve(importRoot, projectFolder);

  if (targetDirectory !== importRoot && !targetDirectory.startsWith(`${importRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Zielpfad liegt ausserhalb des Import-Ordners." }, { status: 400 });
  }

  const sourceBuffer = await readStoredFile({ storedPath: file.storedPath, preferRuntimeRoot: true });
  const targetFilename = `${safeSegment(path.parse(file.name).name)}-${file.id.slice(-8)}${path.extname(file.name) || `.${file.type.toLowerCase()}`}`;
  const targetPath = path.resolve(targetDirectory, targetFilename);

  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(targetPath, sourceBuffer);
  await fs.writeFile(
    path.join(targetDirectory, "makershelf-prusaslicer-import.json"),
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        project: file.project.title,
        fileId: file.id,
        fileName: file.name,
        originalName: file.originalName,
        type: file.type,
        sizeBytes: file.sizeBytes.toString(),
        sourceUrl: file.project.sourceUrl,
        license: file.project.license,
        author: file.project.author,
        targetPath,
      },
      null,
      2,
    ),
  );

  return NextResponse.json({
    ok: true,
    message: "Datei wurde in den PrusaSlicer-Docker-Importordner kopiert.",
    targetPath,
    importRoot,
  });
}
