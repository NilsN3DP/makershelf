import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

const patchSchema = z.object({
  name: z.string().min(1).max(260).optional(),
  tags: z.array(z.string().max(80)).max(30).optional(),
  notes: z.string().max(5000).optional(),
});

function laserStorageRoot(): string {
  const runtimeConfig = getRuntimeConfig();
  const storageRoot = runtimeConfig.storageRoot?.trim()
    ? path.resolve(runtimeConfig.storageRoot)
    : path.resolve(process.cwd(), ".makershelf-storage");
  return path.join(storageRoot, "Laser");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.laserEnabled) {
    return NextResponse.json({ error: "Laser-Modul ist nicht aktiviert." }, { status: 403 });
  }

  const { id } = await context.params;
  const file = await prisma.laserFile.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!file) return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });

  let body;
  try {
    body = patchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const updated = await prisma.laserFile.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.notes !== undefined && { notes: body.notes.trim() }),
    },
  });

  return NextResponse.json({ file: { ...updated, sizeBytes: updated.sizeBytes.toString() } });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.laserEnabled) {
    return NextResponse.json({ error: "Laser-Modul ist nicht aktiviert." }, { status: 403 });
  }

  const { id } = await context.params;
  const file = await prisma.laserFile.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!file) return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });

  // Delete physical file
  try {
    const storageRoot = laserStorageRoot();
    const filename = file.storedPath.replace(/^Laser\//, "");
    await fs.unlink(path.join(storageRoot, filename));
  } catch { /* ignore missing file */ }

  await prisma.laserFile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
