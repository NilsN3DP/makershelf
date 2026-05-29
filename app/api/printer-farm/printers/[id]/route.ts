import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  model: z.string().max(120).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  groupId: z.string().optional().nullable(),
  tags: z.array(z.string().max(60)).optional(),
  apiType: z.enum(["prusa-link", "moonraker", "octoprint"]).optional(),
  apiUrl: z.string().min(1).max(500).optional(),
  apiKey: z.string().max(500).optional().nullable(),
  webcamUrl: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.printerFarmEnabled) {
    return NextResponse.json({ error: "Drucker Farm ist nicht aktiviert." }, { status: 403 });
  }

  const { id } = await context.params;
  const printer = await prisma.printerFarmPrinter.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!printer) return NextResponse.json({ error: "Drucker nicht gefunden." }, { status: 404 });

  let body;
  try {
    body = patchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const updated = await prisma.printerFarmPrinter.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.model !== undefined && { model: body.model?.trim() || null }),
      ...(body.location !== undefined && { location: body.location?.trim() || null }),
      ...(body.groupId !== undefined && { groupId: body.groupId || null }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.apiType !== undefined && { apiType: body.apiType }),
      ...(body.apiUrl !== undefined && { apiUrl: body.apiUrl.trim().replace(/\/$/, "") }),
      ...(body.apiKey !== undefined && { apiKey: body.apiKey?.trim() || null }),
      ...(body.webcamUrl !== undefined && { webcamUrl: body.webcamUrl?.trim() || null }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() || "" }),
    },
    include: { group: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json({ printer: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.printerFarmEnabled) {
    return NextResponse.json({ error: "Drucker Farm ist nicht aktiviert." }, { status: 403 });
  }

  const { id } = await context.params;
  const printer = await prisma.printerFarmPrinter.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!printer) return NextResponse.json({ error: "Drucker nicht gefunden." }, { status: 404 });

  await prisma.printerFarmPrinter.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
