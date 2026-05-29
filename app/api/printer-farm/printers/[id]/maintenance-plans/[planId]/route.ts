import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const updateSchema = z.object({
  type: z.string().max(60).optional(),
  label: z.string().max(120).optional(),
  intervalDays: z.number().int().min(1).max(3650).optional(),
  notifyDaysBefore: z.number().int().min(0).max(365).optional(),
  lastPerformedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).optional(),
  active: z.boolean().optional(),
});

function calcNextDueAt(lastPerformedAt: Date | null | undefined, intervalDays: number): Date {
  const base = lastPerformedAt ?? new Date();
  return new Date(base.getTime() + intervalDays * 86400000);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;
  const { id: printerId, planId } = await params;

  const plan = await prisma.printerFarmMaintenancePlan.findFirst({
    where: { id: planId, printerId, workspaceId, ownerUserId: userId },
  });
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const intervalDays = body.data.intervalDays ?? plan.intervalDays;
  const lastPerformedAt =
    "lastPerformedAt" in body.data
      ? (body.data.lastPerformedAt ? new Date(body.data.lastPerformedAt) : null)
      : plan.lastPerformedAt;
  const nextDueAt = calcNextDueAt(lastPerformedAt, intervalDays);

  const updated = await prisma.printerFarmMaintenancePlan.update({
    where: { id: planId },
    data: {
      ...(body.data.type !== undefined && { type: body.data.type }),
      ...(body.data.label !== undefined && { label: body.data.label.trim() }),
      intervalDays,
      ...(body.data.notifyDaysBefore !== undefined && { notifyDaysBefore: body.data.notifyDaysBefore }),
      lastPerformedAt,
      nextDueAt,
      ...(body.data.notes !== undefined && { notes: body.data.notes.trim() }),
      ...(body.data.active !== undefined && { active: body.data.active }),
    },
  });
  return NextResponse.json({ plan: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;
  const { id: printerId, planId } = await params;

  const plan = await prisma.printerFarmMaintenancePlan.findFirst({
    where: { id: planId, printerId, workspaceId, ownerUserId: userId },
  });
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  await prisma.printerFarmMaintenancePlan.delete({ where: { id: planId } });
  return new Response(null, { status: 204 });
}
