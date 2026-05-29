import { randomUUID } from "node:crypto";

import { FilamentScope, FilamentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { buildOpenPrintTagPayload, deriveFilamentStatus } from "@/src/lib/filament-core.mjs";
import { mapSpool, parseNullableDate } from "@/src/lib/server/filament-helpers";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const spoolSchema = z.object({
  scope: z.enum(["PRIVATE", "TEAM"]).default("PRIVATE"),
  name: z.string().min(1).max(160),
  manufacturer: z.string().max(120).optional().nullable(),
  filamentSeries: z.string().max(120).optional().nullable(),
  manufacturerSku: z.string().max(120).optional().nullable(),
  vendorName: z.string().max(120).optional().nullable(),
  purchaseDate: z.string().max(40).optional().nullable(),
  purchasePriceCents: z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  lotNumber: z.string().max(160).optional().nullable(),
  material: z.string().min(1).max(80),
  colorName: z.string().max(80).optional().nullable(),
  colorHex: z.string().max(16).optional().nullable(),
  diameterMm: z.coerce.number().positive().max(10).default(1.75),
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

function ensureEnabled(settingsJson: unknown) {
  const settings = resolveWorkspaceSettings(settingsJson);
  return settings.filamentVaultEnabled
    ? { ok: true as const, settings }
    : {
        ok: false as const,
        response: NextResponse.json({ error: "Filament Vault ist nicht aktiviert." }, { status: 403 }),
      };
}

function visibleSpoolsWhere(access: Awaited<ReturnType<typeof requireWorkspaceAccess>> & { ok: true }) {
  const or: Prisma.FilamentSpoolWhereInput[] = [
    { scope: FilamentScope.TEAM },
    { ownerUserId: access.session.userId },
  ];
  if (access.permissions.canManageSettings) {
    or.push({ scope: FilamentScope.PRIVATE });
  }
  return { workspaceId: access.membership.workspaceId, OR: or };
}

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const enabled = ensureEnabled(access.membership.workspace.settingsJson);
  if (!enabled.ok) return enabled.response;

  const spools = await prisma.filamentSpool.findMany({
    where: visibleSpoolsWhere(access),
    include: { owner: true, createdBy: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ spools: spools.map(mapSpool) });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung zum Anlegen von Filament." }, { status: 403 });
  }
  const enabled = ensureEnabled(access.membership.workspace.settingsJson);
  if (!enabled.ok) return enabled.response;

  let body;
  try {
    body = spoolSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }
  const status = deriveFilamentStatus(
    body.remainingWeightGrams ?? undefined,
    enabled.settings.filamentLowThresholdGrams,
    body.status ?? FilamentStatus.FULL,
  ) as FilamentStatus;
  const openPrintTagId = enabled.settings.filamentOpenPrintTagEnabled ? `opt-${randomUUID()}` : null;
  const payloadSource = {
    ...body,
    id: openPrintTagId ?? "",
    openPrintTagId,
    openPrintTagVersion: "0.1",
  };

  const spool = await prisma.filamentSpool.create({
    data: {
      workspaceId: access.membership.workspaceId,
      scope: body.scope as FilamentScope,
      ownerUserId: body.scope === "PRIVATE" ? access.session.userId : null,
      createdByUserId: access.session.userId,
      name: body.name.trim(),
      manufacturer: body.manufacturer?.trim() || null,
      filamentSeries: body.filamentSeries?.trim() || null,
      manufacturerSku: body.manufacturerSku?.trim() || null,
      vendorName: body.vendorName?.trim() || null,
      purchaseDate: parseNullableDate(body.purchaseDate),
      purchasePriceCents: body.purchasePriceCents ?? null,
      lotNumber: body.lotNumber?.trim() || null,
      material: body.material.trim().toUpperCase(),
      colorName: body.colorName?.trim() || null,
      colorHex: body.colorHex?.trim() || null,
      diameterMm: body.diameterMm,
      netWeightGrams: body.netWeightGrams ?? null,
      tareWeightGrams: body.tareWeightGrams ?? enabled.settings.filamentDefaultTareGrams,
      remainingWeightGrams: body.remainingWeightGrams ?? body.netWeightGrams ?? null,
      densityGcm3: body.densityGcm3 ?? null,
      nozzleTempMinC: body.nozzleTempMinC ?? null,
      nozzleTempMaxC: body.nozzleTempMaxC ?? null,
      bedTempC: body.bedTempC ?? null,
      flowFactor: body.flowFactor ?? null,
      dryingTempC: body.dryingTempC ?? null,
      dryingHours: body.dryingHours ?? null,
      barcodeValue: body.barcodeValue?.trim() || null,
      barcodeFormat: body.barcodeFormat?.trim() || null,
      externalSpoolUrl: body.externalSpoolUrl?.trim() || null,
      lastScannedAt: body.barcodeValue?.trim() ? new Date() : null,
      location: body.location?.trim() || null,
      status,
      openPrintTagId,
      openPrintTagVersion: openPrintTagId ? "0.1" : null,
      openPrintTagPayloadJson: openPrintTagId ? buildOpenPrintTagPayload(payloadSource) : Prisma.JsonNull,
      notes: body.notes?.trim() || null,
    },
    include: { owner: true, createdBy: true },
  });

  return NextResponse.json({ spool: mapSpool(spool) }, { status: 201 });
}
