import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const createSchema = z.object({
  spoolId: z.string().optional().nullable(),
  materialName: z.string().max(120).default(""),
  colorName: z.string().max(80).default(""),
  gramsUsed: z.number().positive().max(50000),
  jobName: z.string().max(200).default(""),
  notes: z.string().max(2000).default(""),
  loggedAt: z.string().datetime().optional(),
  /** If true and spoolId given, deduct gramsUsed from FilamentSpool.remainingWeightGrams */
  deductFromSpool: z.boolean().default(false),
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

  const logs = await prisma.printerFarmFilamentLog.findMany({
    where: { printerId, workspaceId },
    orderBy: { loggedAt: "desc" },
    take: 200,
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

  const { spoolId, deductFromSpool, gramsUsed, ...rest } = parsed.data;

  // If a spool is linked and deduction requested, update spool remaining weight + create FilamentUsage
  if (spoolId && deductFromSpool) {
    const spool = await prisma.filamentSpool.findFirst({
      where: { id: spoolId, workspaceId },
    });
    if (!spool) return NextResponse.json({ error: "Spule nicht gefunden." }, { status: 404 });

    await prisma.$transaction([
      // Deduct from spool remaining weight
      prisma.filamentSpool.update({
        where: { id: spoolId },
        data: {
          remainingWeightGrams: spool.remainingWeightGrams != null
            ? Math.max(0, spool.remainingWeightGrams - Math.round(gramsUsed))
            : undefined,
        },
      }),
      // Record in FilamentUsage (the standard vault log)
      prisma.filamentUsage.create({
        data: {
          workspaceId,
          spoolId,
          userId,
          gramsUsed: Math.round(gramsUsed),
          note: rest.jobName ? `[Drucker Farm] ${rest.jobName}` : "[Drucker Farm]",
        },
      }),
      // Record in printer-specific log
      prisma.printerFarmFilamentLog.create({
        data: {
          printerId,
          workspaceId,
          ownerUserId: userId,
          spoolId,
          gramsUsed,
          loggedAt: rest.loggedAt ? new Date(rest.loggedAt) : new Date(),
          materialName: rest.materialName,
          colorName: rest.colorName,
          jobName: rest.jobName,
          notes: rest.notes,
        },
      }),
      // Update printer last job info
      prisma.printerFarmPrinter.update({
        where: { id: printerId },
        data: { lastJobName: rest.jobName || printer.lastJobName, lastJobAt: new Date() },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.printerFarmFilamentLog.create({
        data: {
          printerId,
          workspaceId,
          ownerUserId: userId,
          spoolId: spoolId ?? null,
          gramsUsed,
          loggedAt: rest.loggedAt ? new Date(rest.loggedAt) : new Date(),
          materialName: rest.materialName,
          colorName: rest.colorName,
          jobName: rest.jobName,
          notes: rest.notes,
        },
      }),
      prisma.printerFarmPrinter.update({
        where: { id: printerId },
        data: { lastJobName: rest.jobName || printer.lastJobName, lastJobAt: new Date() },
      }),
    ]);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
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

  const log = await prisma.printerFarmFilamentLog.findFirst({
    where: { id: logId, printerId, workspaceId, ownerUserId: userId },
  });
  if (!log) return NextResponse.json({ error: "Eintrag nicht gefunden." }, { status: 404 });

  await prisma.printerFarmFilamentLog.delete({ where: { id: logId } });
  return new Response(null, { status: 204 });
}
