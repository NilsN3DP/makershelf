import { FilamentScope, FilamentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { deriveFilamentStatus } from "@/src/lib/filament-core.mjs";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const usageSchema = z.object({
  spoolId: z.string().min(1),
  gramsUsed: z.coerce.number().int().positive().max(50000),
  projectId: z.string().min(1).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export async function GET(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.filamentVaultEnabled) return NextResponse.json({ error: "Filament Vault ist nicht aktiviert." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const spoolId = searchParams.get("spoolId");

  const entries = await prisma.filamentUsage.findMany({
    where: {
      workspaceId: access.membership.workspaceId,
      ...(spoolId ? { spoolId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      project: { select: { title: true } },
      user: { select: { name: true } },
    },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      gramsUsed: e.gramsUsed,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
      projectTitle: e.project?.title ?? null,
      userName: e.user?.name ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung zum Buchen von Verbrauch." }, { status: 403 });
  }
  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.filamentVaultEnabled) {
    return NextResponse.json({ error: "Filament Vault ist nicht aktiviert." }, { status: 403 });
  }

  let body;
  try {
    body = usageSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }
  const spool = await prisma.filamentSpool.findFirst({
    where: { id: body.spoolId, workspaceId: access.membership.workspaceId },
  });
  if (!spool) return NextResponse.json({ error: "Spule nicht gefunden." }, { status: 404 });
  const canUseSpool =
    spool.scope === FilamentScope.TEAM ||
    spool.ownerUserId === access.session.userId ||
    access.permissions.canManageSettings;
  if (!canUseSpool) return NextResponse.json({ error: "Spule nicht gefunden." }, { status: 404 });

  if (body.projectId) {
    const projectExists = await prisma.project.count({
      where: { id: body.projectId, workspaceId: access.membership.workspaceId },
    });
    if (!projectExists) return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  const remainingWeightGrams =
    spool.remainingWeightGrams === null ? null : Math.max(0, spool.remainingWeightGrams - body.gramsUsed);
  const status = deriveFilamentStatus(
    remainingWeightGrams ?? undefined,
    settings.filamentLowThresholdGrams,
    spool.status,
  ) as FilamentStatus;

  const result = await prisma.$transaction(async (tx) => {
    const usage = await tx.filamentUsage.create({
      data: {
        workspaceId: access.membership.workspaceId,
        spoolId: spool.id,
        userId: access.session.userId,
        projectId: body.projectId || null,
        gramsUsed: body.gramsUsed,
        note: body.note?.trim() || null,
      },
    });
    const updatedSpool = await tx.filamentSpool.update({
      where: { id: spool.id },
      data: { remainingWeightGrams, status },
      include: { owner: true, createdBy: true },
    });
    return { usage, spool: updatedSpool };
  });

  return NextResponse.json({
    usage: result.usage,
    spool: {
      ...result.spool,
      ownerName: result.spool.owner?.name ?? null,
      createdByName: result.spool.createdBy.name,
    },
  });
}
