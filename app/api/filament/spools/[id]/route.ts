import { FilamentScope, FilamentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { buildOpenPrintTagPayload, deriveFilamentStatus } from "@/src/lib/filament-core.mjs";
import { mapSpool, parseNullableDate } from "@/src/lib/server/filament-helpers";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const patchSchema = z.object({
  scope: z.enum(["PRIVATE", "TEAM"]).optional(),
  name: z.string().min(1).max(160).optional(),
  manufacturer: z.string().max(120).optional().nullable(),
  filamentSeries: z.string().max(120).optional().nullable(),
  manufacturerSku: z.string().max(120).optional().nullable(),
  vendorName: z.string().max(120).optional().nullable(),
  purchaseDate: z.string().max(40).optional().nullable(),
  purchasePriceCents: z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  lotNumber: z.string().max(160).optional().nullable(),
  material: z.string().min(1).max(80).optional(),
  colorName: z.string().max(80).optional().nullable(),
  colorHex: z.string().max(16).optional().nullable(),
  diameterMm: z.coerce.number().positive().max(10).optional(),
  netWeightGrams: z.coerce.number().int().min(0).max(50000).optional().nullable(),
  tareWeightGrams: z.coerce.number().int().min(0).max(50000).optional().nullable(),
  remainingWeightGrams: z.coerce.number().int().min(0).max(50000).optional().nullable(),
  densityGcm3: z.coerce.number().positive().max(30).optional().nullable(),
  nozzleTempMinC: z.coerce.number().int().min(0).max(500).optional().nullable(),
  nozzleTempMaxC: z.coerce.number().int().min(0).max(500).optional().nullable(),
  bedTempC: z.coerce.number().int().min(0).max(200).optional().nullable(),
  flowFactor: z.coerce.number().positive().max(5).optional().nullable(),
  dryingTempC: z.coerce.number().int().min(0).max(150).optional().nullable(),
  dryingHours: z.coerce.number().positive().max(240).optional().nullable(),
  barcodeValue: z.string().max(1000).optional().nullable(),
  barcodeFormat: z.string().max(80).optional().nullable(),
  externalSpoolUrl: z.string().max(1000).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  status: z.enum(["FULL", "OPEN", "LOW", "EMPTY", "ARCHIVED"]).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

async function loadEditableSpool(id: string, access: Awaited<ReturnType<typeof requireWorkspaceAccess>> & { ok: true }) {
  const spool = await prisma.filamentSpool.findFirst({
    where: { id, workspaceId: access.membership.workspaceId },
  });
  if (!spool) return null;
  const canEditPrivate = spool.scope === FilamentScope.PRIVATE && spool.ownerUserId === access.session.userId;
  const canEditTeam = spool.scope === FilamentScope.TEAM && access.permissions.canEditProjects;
  const canAdmin = access.permissions.canManageSettings;
  return canEditPrivate || canEditTeam || canAdmin ? spool : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten von Filament." }, { status: 403 });
  }
  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.filamentVaultEnabled) {
    return NextResponse.json({ error: "Filament Vault ist nicht aktiviert." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await loadEditableSpool(id, access);
  if (!current) return NextResponse.json({ error: "Spule nicht gefunden." }, { status: 404 });

  let body;
  try {
    body = patchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }
  const nextScope = (body.scope ?? current.scope) as FilamentScope;
  const nextRemaining = body.remainingWeightGrams ?? current.remainingWeightGrams;
  const nextStatus = deriveFilamentStatus(
    nextRemaining ?? undefined,
    settings.filamentLowThresholdGrams,
    body.status ?? current.status,
  ) as FilamentStatus;
  const data: Prisma.FilamentSpoolUpdateInput = {
    scope: nextScope,
    owner: nextScope === FilamentScope.PRIVATE ? { connect: { id: current.ownerUserId ?? access.session.userId } } : { disconnect: true },
    status: nextStatus,
  };

  if (body.name !== undefined) data.name = body.name.trim();
  if (body.manufacturer !== undefined) data.manufacturer = body.manufacturer?.trim() || null;
  if (body.filamentSeries !== undefined) data.filamentSeries = body.filamentSeries?.trim() || null;
  if (body.manufacturerSku !== undefined) data.manufacturerSku = body.manufacturerSku?.trim() || null;
  if (body.vendorName !== undefined) data.vendorName = body.vendorName?.trim() || null;
  if (body.purchaseDate !== undefined) data.purchaseDate = parseNullableDate(body.purchaseDate);
  if (body.purchasePriceCents !== undefined) data.purchasePriceCents = body.purchasePriceCents;
  if (body.lotNumber !== undefined) data.lotNumber = body.lotNumber?.trim() || null;
  if (body.material !== undefined) data.material = body.material.trim().toUpperCase();
  if (body.colorName !== undefined) data.colorName = body.colorName?.trim() || null;
  if (body.colorHex !== undefined) data.colorHex = body.colorHex?.trim() || null;
  if (body.diameterMm !== undefined) data.diameterMm = body.diameterMm;
  if (body.netWeightGrams !== undefined) data.netWeightGrams = body.netWeightGrams;
  if (body.tareWeightGrams !== undefined) data.tareWeightGrams = body.tareWeightGrams;
  if (body.remainingWeightGrams !== undefined) data.remainingWeightGrams = body.remainingWeightGrams;
  if (body.densityGcm3 !== undefined) data.densityGcm3 = body.densityGcm3;
  if (body.nozzleTempMinC !== undefined) data.nozzleTempMinC = body.nozzleTempMinC;
  if (body.nozzleTempMaxC !== undefined) data.nozzleTempMaxC = body.nozzleTempMaxC;
  if (body.bedTempC !== undefined) data.bedTempC = body.bedTempC;
  if (body.flowFactor !== undefined) data.flowFactor = body.flowFactor;
  if (body.dryingTempC !== undefined) data.dryingTempC = body.dryingTempC;
  if (body.dryingHours !== undefined) data.dryingHours = body.dryingHours;
  if (body.barcodeValue !== undefined) {
    data.barcodeValue = body.barcodeValue?.trim() || null;
    data.lastScannedAt = body.barcodeValue?.trim() ? new Date() : null;
  }
  if (body.barcodeFormat !== undefined) data.barcodeFormat = body.barcodeFormat?.trim() || null;
  if (body.externalSpoolUrl !== undefined) data.externalSpoolUrl = body.externalSpoolUrl?.trim() || null;
  if (body.location !== undefined) data.location = body.location?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  const payloadSource = {
    ...current,
    ...body,
    scope: nextScope,
    status: nextStatus,
    remainingWeightGrams: nextRemaining,
  };
  if (current.openPrintTagId) {
    data.openPrintTagPayloadJson = buildOpenPrintTagPayload(payloadSource);
  }

  const spool = await prisma.filamentSpool.update({
    where: { id: current.id },
    data,
    include: { owner: true, createdBy: true },
  });

  return NextResponse.json({ spool: mapSpool(spool) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung zum Loeschen von Filament." }, { status: 403 });
  }
  const { id } = await context.params;
  const spool = await loadEditableSpool(id, access);
  if (!spool) return NextResponse.json({ error: "Spule nicht gefunden." }, { status: 404 });

  await prisma.filamentSpool.delete({ where: { id: spool.id } });
  return NextResponse.json({ ok: true });
}
