import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

// ---------------------------------------------------------------------------
// HTTP Digest Authentication helper (RFC 7616 / RFC 2617)
// Used by PrusaLink v1 (Prusa Core One, MK4 with newer firmware).
// ---------------------------------------------------------------------------
function md5(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

function parseDigestChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  const rx = /(\w+)=(?:"([^"]*)"|([\w/+.-]+))/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(header)) !== null) {
    params[m[1]] = m[2] ?? m[3];
  }
  return params;
}

async function fetchWithDigestAuth(
  url: string,
  init: RequestInit,
  username: string,
  password: string,
): Promise<Response> {
  // First attempt — may return 401 with Digest challenge.
  const first = await fetch(url, init);
  if (first.status !== 401) return first;

  const wwwAuth = first.headers.get("WWW-Authenticate") ?? "";
  if (!wwwAuth.startsWith("Digest ")) return first;

  const p = parseDigestChallenge(wwwAuth);
  const { realm = "", nonce = "", qop = "auth", opaque } = p;

  const uri = new URL(url).pathname + new URL(url).search;
  const method = (typeof init.method === "string" ? init.method : "GET").toUpperCase();
  const nc = "00000001";
  const cnonce = Math.random().toString(36).slice(2, 10);

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `response="${response}"`,
  ];
  if (qop) parts.push(`qop=${qop}`);
  if (opaque) parts.push(`opaque="${opaque}"`);

  const headers = new Headers(init.headers as HeadersInit | undefined);
  headers.set("Authorization", `Digest ${parts.join(", ")}`);

  return fetch(url, { ...init, headers });
}

export type PrinterFarmStatus = {
  ok: boolean;
  connected: boolean;
  state: string | null;
  progress: number | null;
  jobName: string | null;
  filamentUsedMm: number | null;
  filamentUsedG: number | null;
  timeRemainingS: number | null;
  timePrintingS: number | null;
  bedTempC: number | null;
  nozzleTempC: number | null;
  error?: string;
};

const empty: Omit<PrinterFarmStatus, "ok" | "connected" | "error"> = {
  state: null, progress: null, jobName: null,
  filamentUsedMm: null, filamentUsedG: null,
  timeRemainingS: null, timePrintingS: null,
  bedTempC: null, nozzleTempC: null,
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const printer = await prisma.printerFarmPrinter.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });

  if (!printer) {
    return NextResponse.json({ ok: false, connected: false, ...empty, error: "Drucker nicht gefunden." }, { status: 404 });
  }

  const base = printer.apiUrl.trim().replace(/\/$/, "");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (printer.apiKey?.trim()) headers["X-Api-Key"] = printer.apiKey.trim();

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    let status: PrinterFarmStatus;
    if (printer.apiType === "prusa-link") {
      status = await fetchPrusaLink(base, headers, abort.signal, printer.apiKey?.trim() ?? "");
    } else if (printer.apiType === "moonraker") {
      status = await fetchMoonraker(base, headers, abort.signal);
    } else {
      status = await fetchOctoprint(base, headers, abort.signal);
    }
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({
      ok: false, connected: false, ...empty,
      error: err instanceof Error ? err.message : "Verbindung fehlgeschlagen.",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPrusaLink(
  base: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  apiKey: string,
): Promise<PrinterFarmStatus> {
  // PrusaLink v1 (Core One, newer MK4) uses HTTP Digest auth with username "maker".
  // Older PrusaLink uses X-Api-Key header (already set in `headers`).
  // We attempt the request; if we get a Digest challenge we retry automatically.
  const doFetch = (url: string) =>
    apiKey
      ? fetchWithDigestAuth(url, { headers, signal }, "maker", apiKey)
      : fetch(url, { headers, signal });

  const jobRes = await doFetch(`${base}/api/v1/job`);
  if (jobRes.status === 404) {
    const legacyRes = await doFetch(`${base}/api/job`);
    if (!legacyRes.ok) throw new Error(`HTTP ${legacyRes.status}`);
    return parsePrusaLinkLegacy(await legacyRes.json() as Record<string, unknown>);
  }
  // 204 = printer is idle, no active job — valid response, no body
  if (jobRes.status === 204) {
    let bedTempC: number | null = null;
    let nozzleTempC: number | null = null;
    try {
      const statusRes = await doFetch(`${base}/api/v1/status`);
      if (statusRes.ok) {
        const sd = await statusRes.json() as Record<string, unknown>;
        const printer = sd.printer as Record<string, unknown> | undefined;
        bedTempC = typeof printer?.temp_bed === "number" ? printer.temp_bed : null;
        nozzleTempC = typeof printer?.temp_nozzle === "number" ? printer.temp_nozzle : null;
      }
    } catch { /* temperatures optional */ }
    return { ok: true, connected: true, state: "IDLE", progress: null, jobName: null, filamentUsedMm: null, filamentUsedG: null, timeRemainingS: null, timePrintingS: null, bedTempC, nozzleTempC };
  }
  if (!jobRes.ok) throw new Error(`HTTP ${jobRes.status}`);
  const jobData = await jobRes.json() as Record<string, unknown>;

  let bedTempC: number | null = null;
  let nozzleTempC: number | null = null;
  try {
    const statusRes = await doFetch(`${base}/api/v1/status`);
    if (statusRes.ok) {
      const sd = await statusRes.json() as Record<string, unknown>;
      const printer = sd.printer as Record<string, unknown> | undefined;
      bedTempC = typeof printer?.temp_bed === "number" ? printer.temp_bed : null;
      nozzleTempC = typeof printer?.temp_nozzle === "number" ? printer.temp_nozzle : null;
    }
  } catch { /* temperatures are optional */ }

  const filament = jobData.filament as Record<string, unknown> | undefined;
  const file = jobData.file as Record<string, unknown> | undefined;
  return {
    ok: true, connected: true,
    state: typeof jobData.state === "string" ? jobData.state : null,
    progress: typeof jobData.progress === "number" ? jobData.progress : null,
    jobName: typeof file?.name === "string" ? file.name : null,
    filamentUsedMm: typeof filament?.used_mm === "number" ? filament.used_mm : null,
    filamentUsedG: typeof filament?.used_g === "number" ? filament.used_g : null,
    timeRemainingS: typeof jobData.time_remaining === "number" ? jobData.time_remaining : null,
    timePrintingS: typeof jobData.time_printing === "number" ? jobData.time_printing : null,
    bedTempC, nozzleTempC,
  };
}

function parsePrusaLinkLegacy(data: Record<string, unknown>): PrinterFarmStatus {
  const stateObj = data.state as Record<string, unknown> | undefined;
  const progressObj = data.progress as Record<string, unknown> | undefined;
  const jobObj = data.job as Record<string, unknown> | undefined;
  const fileObj = (jobObj?.file ?? {}) as Record<string, unknown>;
  const filamentObj = (jobObj?.filament ?? {}) as Record<string, unknown>;
  return {
    ok: true, connected: true,
    state: typeof stateObj?.text === "string" ? stateObj.text : null,
    progress: typeof progressObj?.completion === "number" ? progressObj.completion * 100 : null,
    jobName: typeof fileObj.name === "string" ? fileObj.name : null,
    filamentUsedMm: typeof filamentObj.used === "number" ? filamentObj.used : null,
    filamentUsedG: null,
    timeRemainingS: typeof progressObj?.printTimeLeft === "number" ? progressObj.printTimeLeft : null,
    timePrintingS: typeof progressObj?.printTime === "number" ? progressObj.printTime : null,
    bedTempC: null, nozzleTempC: null,
  };
}

async function fetchMoonraker(
  base: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<PrinterFarmStatus> {
  const [jobRes, tempRes] = await Promise.all([
    fetch(`${base}/printer/objects/query?print_stats&display_status`, { headers, signal }),
    fetch(`${base}/printer/objects/query?extruder&heater_bed`, { headers, signal }),
  ]);
  if (!jobRes.ok) throw new Error(`HTTP ${jobRes.status}`);
  const jd = await jobRes.json() as Record<string, unknown>;
  const status = (jd.result as Record<string, unknown> | undefined)?.status as Record<string, unknown> | undefined;
  const printStats = status?.print_stats as Record<string, unknown> | undefined;
  const displayStatus = status?.display_status as Record<string, unknown> | undefined;

  let nozzleTempC: number | null = null;
  let bedTempC: number | null = null;
  if (tempRes.ok) {
    const td = await tempRes.json() as Record<string, unknown>;
    const ts = (td.result as Record<string, unknown> | undefined)?.status as Record<string, unknown> | undefined;
    const extruder = ts?.extruder as Record<string, unknown> | undefined;
    const heaterBed = ts?.heater_bed as Record<string, unknown> | undefined;
    nozzleTempC = typeof extruder?.temperature === "number" ? extruder.temperature : null;
    bedTempC = typeof heaterBed?.temperature === "number" ? heaterBed.temperature : null;
  }

  const rawState = printStats?.state as string | undefined;
  const stateMap: Record<string, string> = {
    printing: "printing", paused: "paused", error: "error",
    complete: "idle", standby: "idle",
  };
  return {
    ok: true, connected: true,
    state: rawState ? (stateMap[rawState] ?? rawState) : null,
    progress: typeof displayStatus?.progress === "number"
      ? Math.round(displayStatus.progress * 100) : null,
    jobName: typeof printStats?.filename === "string" ? printStats.filename : null,
    filamentUsedMm: typeof printStats?.filament_used === "number" ? printStats.filament_used : null,
    filamentUsedG: null,
    timeRemainingS: null,
    timePrintingS: typeof printStats?.print_duration === "number" ? printStats.print_duration : null,
    bedTempC, nozzleTempC,
  };
}

async function fetchOctoprint(
  base: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<PrinterFarmStatus> {
  const [jobRes, printerRes] = await Promise.all([
    fetch(`${base}/api/job`, { headers, signal }),
    fetch(`${base}/api/printer`, { headers, signal }),
  ]);
  if (!jobRes.ok) throw new Error(`HTTP ${jobRes.status}`);
  const jobData = await jobRes.json() as Record<string, unknown>;
  const stateObj = jobData.state as Record<string, unknown> | undefined;
  const progressObj = jobData.progress as Record<string, unknown> | undefined;
  const jobInner = jobData.job as Record<string, unknown> | undefined;
  const fileObj = (jobInner?.file ?? {}) as Record<string, unknown>;
  const filamentObj = (jobInner?.filament ?? {}) as Record<string, unknown>;

  let nozzleTempC: number | null = null;
  let bedTempC: number | null = null;
  if (printerRes.ok) {
    const pd = await printerRes.json() as Record<string, unknown>;
    const temps = pd.temperature as Record<string, unknown> | undefined;
    const tool0 = temps?.tool0 as Record<string, unknown> | undefined;
    const bed = temps?.bed as Record<string, unknown> | undefined;
    nozzleTempC = typeof tool0?.actual === "number" ? tool0.actual : null;
    bedTempC = typeof bed?.actual === "number" ? bed.actual : null;
  }

  return {
    ok: true, connected: true,
    state: typeof stateObj?.text === "string" ? stateObj.text : null,
    progress: typeof progressObj?.completion === "number" ? progressObj.completion * 100 : null,
    jobName: typeof fileObj.name === "string" ? fileObj.name : null,
    filamentUsedMm: typeof filamentObj.used === "number" ? filamentObj.used : null,
    filamentUsedG: null,
    timeRemainingS: typeof progressObj?.printTimeLeft === "number" ? progressObj.printTimeLeft : null,
    timePrintingS: typeof progressObj?.printTime === "number" ? progressObj.printTime : null,
    bedTempC, nozzleTempC,
  };
}
