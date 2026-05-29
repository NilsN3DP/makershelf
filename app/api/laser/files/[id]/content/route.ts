import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

const MIME_MAP: Record<string, string> = {
  svg: "image/svg+xml",
  dxf: "application/dxf",
  plt: "application/octet-stream",
  ai: "application/postscript",
  pdf: "application/pdf",
  eps: "application/postscript",
  gcode: "text/plain",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const file = await prisma.laserFile.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!file) return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });

  const runtimeConfig = getRuntimeConfig();
  const storageRoot = runtimeConfig.storageRoot?.trim()
    ? path.resolve(runtimeConfig.storageRoot)
    : path.resolve(process.cwd(), ".makershelf-storage");
  const filename = file.storedPath.replace(/^Laser\//, "");
  const filePath = path.join(storageRoot, "Laser", filename);

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await fs.readFile(filePath));
  } catch {
    return NextResponse.json({ error: "Datei nicht auf dem Server gefunden." }, { status: 404 });
  }

  const mimeType = MIME_MAP[file.fileType] ?? "application/octet-stream";
  return new NextResponse(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
