import packageJson from "@/package.json";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export type MakershelfLicenseTier = "community" | "commercial";
export type MakershelfLicenseState = "active" | "needs-check" | "unconfigured" | "invalid";

const COMMUNITY_RECHECK_DAYS = 183;
const COMMERCIAL_RECHECK_DAYS = 30;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeTier(value?: string): MakershelfLicenseTier | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "commercial") return "commercial";
  if (normalized === "community") return "community";
  return undefined;
}

function inferTierFromKey(key?: string): MakershelfLicenseTier | undefined {
  const normalized = key?.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized.startsWith("MAKERSHELF-COM-") || normalized.startsWith("MAKERSHELF-COM-")) return "commercial";
  if (normalized.startsWith("MAKERSHELF-COMMUNITY-") || normalized.startsWith("MAKERSHELF-COMMUNITY-")) return "community";
  return undefined;
}

export function buildLicenseStatus() {
  const config = getRuntimeConfig();
  const now = new Date();
  const tier = normalizeTier(config.licenseTier) ?? inferTierFromKey(config.licenseKey) ?? "community";
  const recheckDays = tier === "community" ? COMMUNITY_RECHECK_DAYS : COMMERCIAL_RECHECK_DAYS;
  const lastCheck = parseDate(config.licenseLastCheck);
  const nextCheckAt = addDays(lastCheck ?? now, recheckDays);
  const hasServer = Boolean(config.licenseServerUrl);
  const hasKey = Boolean(config.licenseKey);
  const needsCheck = nextCheckAt.getTime() < now.getTime();

  const state: MakershelfLicenseState = !hasServer && tier === "commercial"
    ? "unconfigured"
    : needsCheck
      ? "needs-check"
      : "active";

  return {
    product: "makershelf",
    version: packageJson.version,
    tier,
    state,
    communityRecheckDays: COMMUNITY_RECHECK_DAYS,
    nextCheckAt: nextCheckAt.toISOString(),
    lastCheckAt: lastCheck?.toISOString() ?? "",
    licenseServerUrl: config.licenseServerUrl ?? "",
    instanceId: config.instanceId ?? "",
    keyConfigured: hasKey,
    message:
      state === "active"
        ? tier === "community"
          ? "Community-Lizenz aktiv. Die nächste Prüfung ist in spätestens sechs Monaten fällig."
          : "Commercial-Lizenz aktiv."
        : state === "needs-check"
          ? "Lizenzprüfung ist fällig. Bitte Lizenzserver prüfen oder MAKERSHELF_LICENSE_LAST_CHECK aktualisieren."
          : "Commercial-Lizenz benötigt einen konfigurierten Lizenzserver.",
  };
}

export async function verifyWithLicenseServer(input: {
  licenseKey: string;
  tier?: MakershelfLicenseTier;
  instanceId?: string;
}) {
  const config = getRuntimeConfig();
  const serverUrl = config.licenseServerUrl?.replace(/\/+$/, "");
  const inferredTier = input.tier ?? inferTierFromKey(input.licenseKey);

  if (!serverUrl) {
    if (!inferredTier) {
      return {
        ok: false,
        tier: "community" as MakershelfLicenseTier,
        state: "invalid" as MakershelfLicenseState,
        message: "Lizenzschlüssel konnte lokal nicht erkannt werden und kein Lizenzserver ist konfiguriert.",
      };
    }

    return {
      ok: true,
      tier: inferredTier,
      state: "active" as MakershelfLicenseState,
      nextCheckAt: addDays(new Date(), inferredTier === "community" ? COMMUNITY_RECHECK_DAYS : COMMERCIAL_RECHECK_DAYS).toISOString(),
      message: "Lizenz lokal erkannt. Für produktive Aktivierungen bitte MAKERSHELF_LICENSE_SERVER_URL konfigurieren.",
    };
  }

  const response = await fetch(`${serverUrl}/api/license/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Makershelf-License-Client" },
    body: JSON.stringify({
      product: "makershelf",
      version: packageJson.version,
      licenseKey: input.licenseKey,
      tier: inferredTier,
      instanceId: input.instanceId ?? config.instanceId ?? "",
    }),
  });

  const payload = (await response.json()) as {
    ok?: boolean;
    tier?: MakershelfLicenseTier;
    state?: MakershelfLicenseState;
    nextCheckAt?: string;
    message?: string;
  };

  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      tier: payload.tier ?? inferredTier ?? "community",
      state: payload.state ?? "invalid",
      message: payload.message ?? `Lizenzserver hat die Aktivierung abgelehnt (${response.status}).`,
    };
  }

  return {
    ok: true,
    tier: payload.tier ?? inferredTier ?? "community",
    state: payload.state ?? "active",
    nextCheckAt: payload.nextCheckAt ?? addDays(new Date(), COMMUNITY_RECHECK_DAYS).toISOString(),
    message: payload.message ?? "Lizenz wurde erfolgreich geprüft.",
  };
}
