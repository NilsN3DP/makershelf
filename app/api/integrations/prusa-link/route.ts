import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { getWorkspaceSnapshotData } from "@/src/lib/server/queries";
import { mapWorkspaceToSnapshot } from "@/src/lib/server/snapshot";

export type PrusaLinkStatus = {
  ok: boolean;
  connected: boolean;
  state: string | null;
  progress: number | null;
  jobName: string | null;
  filamentUsedMm: number | null;
  filamentUsedG: number | null;
  timeRemainingS: number | null;
  timePrintingS: number | null;
  error?: string;
};

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const workspaceData = await getWorkspaceSnapshotData(access.membership.workspaceId);
  if (!workspaceData) {
    return NextResponse.json({ ok: false, connected: false, error: "Workspace nicht gefunden." });
  }
  const snap = mapWorkspaceToSnapshot(workspaceData);
  const settings = snap.settings;

  if (!settings.prusaLinkEnabled || !settings.prusaLinkUrl.trim()) {
    return NextResponse.json({ ok: false, connected: false, error: "Prusa Link nicht konfiguriert." });
  }

  const base = settings.prusaLinkUrl.trim().replace(/\/$/, "");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (settings.prusaLinkApiKey.trim()) {
    headers["X-Api-Key"] = settings.prusaLinkApiKey.trim();
  }

  // Single 5-second budget shared across both fetches (v1 → legacy fallback)
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    const res = await fetch(`${base}/api/v1/job`, { headers, signal: abort.signal });
    if (res.status === 404) {
      // Legacy OctoPrint-style endpoint for older firmware
      const legacyRes = await fetch(`${base}/api/job`, { headers, signal: abort.signal });
      if (!legacyRes.ok) throw new Error(`HTTP ${legacyRes.status}`);
      const data = await legacyRes.json() as Record<string, unknown>;
      return NextResponse.json(parseLegacyJob(data));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json(parseV1Job(data));
  } catch (err) {
    return NextResponse.json({
      ok: false,
      connected: false,
      error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen.",
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseV1Job(data: Record<string, unknown>): PrusaLinkStatus {
  const state = typeof data.state === "string" ? data.state : null;
  const progress = typeof data.progress === "number" ? data.progress : null;
  const file = data.file as Record<string, unknown> | undefined;
  const filament = data.filament as Record<string, unknown> | undefined;
  return {
    ok: true,
    connected: true,
    state,
    progress,
    jobName: typeof file?.name === "string" ? file.name : null,
    filamentUsedMm: typeof filament?.used_mm === "number" ? filament.used_mm : null,
    filamentUsedG: typeof filament?.used_g === "number" ? filament.used_g : null,
    timeRemainingS: typeof data.time_remaining === "number" ? data.time_remaining : null,
    timePrintingS: typeof data.time_printing === "number" ? data.time_printing : null,
  };
}

function parseLegacyJob(data: Record<string, unknown>): PrusaLinkStatus {
  const stateObj = data.state as Record<string, unknown> | undefined;
  const progressObj = data.progress as Record<string, unknown> | undefined;
  const jobObj = data.job as Record<string, unknown> | undefined;
  const filamentObj = (jobObj?.filament ?? {}) as Record<string, unknown>;
  const fileObj = (jobObj?.file ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    connected: true,
    state: typeof stateObj?.text === "string" ? stateObj.text : null,
    progress: typeof progressObj?.completion === "number" ? progressObj.completion * 100 : null,
    jobName: typeof fileObj.name === "string" ? fileObj.name : null,
    filamentUsedMm: typeof filamentObj.used === "number" ? filamentObj.used : null,
    filamentUsedG: null,
    timeRemainingS: typeof progressObj?.printTimeLeft === "number" ? progressObj.printTimeLeft : null,
    timePrintingS: typeof progressObj?.printTime === "number" ? progressObj.printTime : null,
  };
}
