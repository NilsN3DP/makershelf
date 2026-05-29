import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const MAINTENANCE_TYPES = ["cleaning", "filament_change", "calibration", "repair", "nozzle_change", "bed_leveling", "lubrication", "firmware_update", "other"] as const;

const createSchema = z.object({
  type: z.enum(MAINTENANCE_TYPES).default("other"),
  notes: z.string().max(2000).default(""),
  performedAt: z.string().datetime().optional(),
});

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
  if (!printer) return NextResponse.json({ error: "Drucker nicht gefunden." }, { status: 404 });

  const logs = await prisma.printerFarmMaintenanceLog.findMany({
    where: { printerId, workspaceId },
    orderBy: { performedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(logs);
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
  if (!printer) return NextResponse.json({ error: "Drucker nicht gefunden." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });

  const log = await prisma.printerFarmMaintenanceLog.create({
    data: {
      printerId,
      workspaceId,
      ownerUserId: userId,
      type: parsed.data.type,
      notes: parsed.data.notes,
      performedAt: parsed.data.performedAt ? new Date(parsed.data.performedAt) : new Date(),
    },
  });
  return NextResponse.json(log, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;
  const { id: printerId } = await params;

  const url = new URL(request.url);
  const logId = url.searchParams.get("logId");
  if (!logId) return NextResponse.json({ error: "logId fehlt." }, { status: 400 });

  const log = await prisma.printerFarmMaintenanceLog.findFirst({
    where: { id: logId, printerId, workspaceId, ownerUserId: userId },
  });
  if (!log) return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });

  await prisma.printerFarmMaintenanceLog.delete({ where: { id: logId } });
  return new Response(null, { status: 204 });
}
