/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

export const dynamic = "force-dynamic";

type ApiType = "prusa-link" | "moonraker" | "octoprint";

export type DiscoveredPrinter = {
  name: string;
  host: string;
  ip: string;
  port: number;
  apiType: ApiType;
  apiUrl: string;
};

const MDNS_SCANS: Array<{ type: string; apiType: ApiType }> = [
  { type: "prusalink", apiType: "prusa-link" },
  { type: "http", apiType: "prusa-link" },
  { type: "moonraker", apiType: "moonraker" },
  { type: "octoprint", apiType: "octoprint" },
];

function inferApiType(service: any, fallback: ApiType): ApiType {
  const raw = [
    service.name,
    service.host,
    service.fqdn,
    service.type,
    service.txt?.path,
    service.txt?.api,
  ].filter(Boolean).join(" ").toLowerCase();

  if (raw.includes("moonraker") || raw.includes("klipper")) return "moonraker";
  if (raw.includes("octoprint")) return "octoprint";
  if (raw.includes("prusa") || raw.includes("prusainterface") || raw.includes("prusalink")) return "prusa-link";
  return fallback;
}

function scanMdnsType(bonjour: any, type: string, fallbackApiType: ApiType, ms: number): Promise<DiscoveredPrinter[]> {
  return new Promise((resolve) => {
    const found: DiscoveredPrinter[] = [];
    try {
      const browser = bonjour.find({ type });
      browser.on("up", (service: any) => {
        const ip: string =
          (service.addresses as string[] | undefined)?.find((a) => !a.includes(":")) ?? (service.host as string);
        const apiType = inferApiType(service, fallbackApiType);
        found.push({
          name: String(service.name),
          host: String(service.host),
          ip,
          port: Number(service.port),
          apiType,
          apiUrl: `http://${ip}:${service.port}`,
        });
      });
      setTimeout(() => {
        try { browser.stop(); } catch { /* ignore */ }
        resolve(found);
      }, ms);
    } catch {
      resolve(found);
    }
  });
}

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.printerFarmEnabled) {
    return NextResponse.json({ error: "Drucker Farm ist nicht aktiviert." }, { status: 403 });
  }

  try {
    const mod = await import("bonjour-service");
    const BonjourCtor = (mod.default ?? mod) as new () => any;
    const bonjour = new BonjourCtor();

    const SCAN_MS = 5000;
    const results = await Promise.all(MDNS_SCANS.map((scan) => scanMdnsType(bonjour, scan.type, scan.apiType, SCAN_MS)));

    try { bonjour.destroy(); } catch { /* ignore */ }

    const all = results.flat();
    const seen = new Set<string>();
    const unique = all.filter((p) => {
      if (seen.has(p.apiUrl)) return false;
      seen.add(p.apiUrl);
      return true;
    });

    return NextResponse.json({ printers: unique, scannedTypes: MDNS_SCANS.map((scan) => scan.type) });
  } catch (err) {
    console.error("[printer-farm/discover] mDNS scan error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json(
      { printers: [], error: `mDNS-Scan nicht verfügbar: ${message}`, scannedTypes: MDNS_SCANS.map((scan) => scan.type) },
      { status: 500 },
    );
  }
}
