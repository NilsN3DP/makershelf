import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });

  const existing = await prisma.printerFarmGroup.findFirst({
    where: { id, workspaceId, ownerUserId: userId },
  });
  if (!existing) return NextResponse.json({ error: "Gruppe nicht gefunden." }, { status: 404 });

  const group = await prisma.printerFarmGroup.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(group);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;
  const { id } = await params;

  const existing = await prisma.printerFarmGroup.findFirst({
    where: { id, workspaceId, ownerUserId: userId },
  });
  if (!existing) return NextResponse.json({ error: "Gruppe nicht gefunden." }, { status: 404 });

  // Unassign printers before deleting group
  await prisma.printerFarmPrinter.updateMany({
    where: { groupId: id },
    data: { groupId: null },
  });
  await prisma.printerFarmGroup.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
