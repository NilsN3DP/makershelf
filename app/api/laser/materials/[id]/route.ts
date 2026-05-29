import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  material: z.string().min(1).max(120).optional(),
  laserType: z.string().max(60).optional(),
  powerPct: z.number().int().min(0).max(100).optional(),
  speedMmMin: z.number().int().min(1).max(100000).optional(),
  passes: z.number().int().min(1).max(50).optional(),
  intervalMm: z.number().positive().max(100).optional().nullable(),
  airAssist: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

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
  const profile = await prisma.laserMaterialProfile.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!profile) return NextResponse.json({ error: "Profil nicht gefunden." }, { status: 404 });

  let body;
  try {
    body = patchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const updated = await prisma.laserMaterialProfile.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.material !== undefined && { material: body.material.trim() }),
      ...(body.laserType !== undefined && { laserType: body.laserType.trim() }),
      ...(body.powerPct !== undefined && { powerPct: body.powerPct }),
      ...(body.speedMmMin !== undefined && { speedMmMin: body.speedMmMin }),
      ...(body.passes !== undefined && { passes: body.passes }),
      ...(body.intervalMm !== undefined && { intervalMm: body.intervalMm }),
      ...(body.airAssist !== undefined && { airAssist: body.airAssist }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() || "" }),
    },
  });

  return NextResponse.json({ profile: updated });
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
  const profile = await prisma.laserMaterialProfile.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!profile) return NextResponse.json({ error: "Profil nicht gefunden." }, { status: 404 });

  await prisma.laserMaterialProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
