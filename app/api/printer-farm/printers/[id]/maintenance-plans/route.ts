import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const planSchema = z.object({
  type: z.string().max(60).default("other"),
  label: z.string().max(120).default(""),
  intervalDays: z.number().int().min(1).max(3650),
  notifyDaysBefore: z.number().int().min(0).max(365).default(3),
  lastPerformedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).default(""),
  active: z.boolean().default(true),
});

function calcNextDueAt(lastPerformedAt: Date | null | undefined, intervalDays: number): Date {
  const base = lastPerformedAt ?? new Date();
  return new Date(base.getTime() + intervalDays * 86400000);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;
  const { id: printerId } = await params;

  const printer = await prisma.printerFarmPrinter.findFirst({
    where: { id: printerId, workspaceId, ownerUserId: userId },
  });
  if (!printer) return NextResponse.json({ error: "Printer not found." }, { status: 404 });

  const plans = await prisma.printerFarmMaintenancePlan.findMany({
    where: { printerId, workspaceId },
    orderBy: [{ active: "desc" }, { nextDueAt: "asc" }],
  });
  return NextResponse.json({ plans });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;
  const { id: printerId } = await params;

  const printer = await prisma.printerFarmPrinter.findFirst({
    where: { id: printerId, workspaceId, ownerUserId: userId },
  });
  if (!printer) return NextResponse.json({ error: "Printer not found." }, { status: 404 });

  const body = planSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const lastPerformedAt = body.data.lastPerformedAt ? new Date(body.data.lastPerformedAt) : null;
  const nextDueAt = calcNextDueAt(lastPerformedAt, body.data.intervalDays);

  const plan = await prisma.printerFarmMaintenancePlan.create({
    data: {
      printerId,
      workspaceId,
      ownerUserId: userId,
      type: body.data.type,
      label: body.data.label.trim(),
      intervalDays: body.data.intervalDays,
      notifyDaysBefore: body.data.notifyDaysBefore,
      lastPerformedAt,
      nextDueAt,
      notes: body.data.notes.trim(),
      active: body.data.active,
    },
  });
  return NextResponse.json({ plan }, { status: 201 });
}
