import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { isPrusamentSpoolUrl, parseFilamentScan, parsePrusamentSpoolHtml } from "@/src/lib/filament-presets.mjs";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const SCAN_FETCH_TIMEOUT_MS = 8_000;

// ─── OpenPrintTag URL helpers ─────────────────────────────────────────────────

/** Returns true for any HTTP/HTTPS URL that might carry OpenPrintTag data. */
function isOpenPrintTagCompatibleUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type OpenPrintTagPayload = Record<string, unknown>;

/**
 * Map an OpenPrintTag spool payload to the standard scan suggestion shape.
 * Works for any registry that returns `schema: "org.openprinttag.spool"` JSON.
 */
function openPrintTagPayloadToScanResult(rawUrl: string, json: OpenPrintTagPayload) {
  const spool = (json.spool ?? json) as Record<string, unknown>;
  const materialProfile = (spool.materialProfile ?? {}) as Record<string, unknown>;
  const printProfile = (spool.printProfile ?? {}) as Record<string, unknown>;

  function str(v: unknown): string {
    return typeof v === "string" ? v : "";
  }
  function numOrNull(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  const netWeightGrams = numOrNull(spool.netWeightGrams);

  return {
    rawValue: rawUrl,
    barcodeFormat: "QR_URL",
    parser: "openprinttag-registry",
    confidence: "high",
    suggestion: {
      name: str(spool.name),
      manufacturer: str(spool.manufacturer),
      filamentSeries: str(spool.filamentSeries),
      manufacturerSku: str(spool.manufacturerSku),
      vendorName: str(spool.vendorName),
      purchaseDate: str(spool.purchaseDate) || null,
      lotNumber: str(spool.lotNumber),
      material: str(spool.material),
      colorName: str(spool.colorName),
      colorHex: str(spool.colorHex),
      location: str(spool.location),
      netWeightGrams,
      tareWeightGrams: numOrNull(spool.tareWeightGrams),
      remainingWeightGrams: numOrNull(spool.remainingWeightGrams) ?? netWeightGrams,
      densityGcm3: numOrNull(materialProfile.densityGcm3),
      flowFactor: numOrNull(materialProfile.flowFactor),
      nozzleTempMinC: numOrNull(printProfile.nozzleTempMinC),
      nozzleTempMaxC: numOrNull(printProfile.nozzleTempMaxC),
      bedTempC: numOrNull(printProfile.bedTempC),
      dryingTempC: numOrNull(printProfile.dryingTempC),
      dryingHours: numOrNull(printProfile.dryingHours),
      externalSpoolUrl: str(spool.externalSpoolUrl) || rawUrl,
      barcodeValue: rawUrl,
      notes: str(spool.notes),
    },
  };
}

const scanSchema = z.object({
  value: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.filamentVaultEnabled) {
    return NextResponse.json({ error: "Filament Vault ist nicht aktiviert." }, { status: 403 });
  }

  let body;
  try {
    body = scanSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  if (isPrusamentSpoolUrl(body.value)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SCAN_FETCH_TIMEOUT_MS);
      const response = await fetch(body.value, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "makershelf Filament Vault/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);
      if (response.ok) {
        const parsed = parsePrusamentSpoolHtml(body.value, await response.text());
        if (parsed) {
          return NextResponse.json(parsed);
        }
      }
    } catch {
      // Fall back to OpenPrintTag fetch or local QR parsing below.
    }
  }

  // ── OpenPrintTag registry / own-instance tag lookup ────────────────────────
  // Try fetching the URL as JSON. If the response contains an OpenPrintTag
  // payload (schema: "org.openprinttag.spool") we return rich spool metadata.
  // This handles: own-instance tags (/api/filament/tag/:id), community
  // registries (openfilament.org, etc.), and any manufacturer that ships
  // OpenPrintTag-compliant NFC tags.
  if (isOpenPrintTagCompatibleUrl(body.value)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SCAN_FETCH_TIMEOUT_MS);
      const response = await fetch(body.value.trim(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "makershelf Filament Vault/1.0",
          Accept: "application/json, */*;q=0.8",
        },
      });
      clearTimeout(timer);

      if (response.ok) {
        const ct = response.headers.get("content-type") ?? "";
        if (ct.includes("json")) {
          const json = await response.json() as OpenPrintTagPayload;
          if (json && json.schema === "org.openprinttag.spool") {
            return NextResponse.json(
              openPrintTagPayloadToScanResult(body.value, json),
            );
          }
        }
      }
    } catch {
      // Not an OpenPrintTag endpoint — fall through to generic parser.
    }
  }

  return NextResponse.json(parseFilamentScan(body.value));
}
