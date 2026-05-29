import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const controlSchema = z.object({
  action: z.enum(["pause", "resume", "stop"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const printer = await prisma.printerFarmPrinter.findFirst({
    where: { id, workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
  });
  if (!printer) return NextResponse.json({ error: "Drucker nicht gefunden." }, { status: 404 });

  let body;
  try {
    body = controlSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
    }
    throw error;
  }

  const base = printer.apiUrl.trim().replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (printer.apiKey?.trim()) headers["X-Api-Key"] = printer.apiKey.trim();

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    await sendControlCommand(printer.apiType, base, headers, body.action, abort.signal);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Befehl fehlgeschlagen.",
    }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

async function sendControlCommand(
  apiType: string,
  base: string,
  headers: Record<string, string>,
  action: "pause" | "resume" | "stop",
  signal: AbortSignal,
): Promise<void> {
  if (apiType === "prusa-link") {
    // PrusaLink v1 job control
    const method = action === "stop" ? "DELETE" : "PUT";
    const url = action === "stop"
      ? `${base}/api/v1/job`
      : `${base}/api/v1/job/state`;
    const body = action === "pause"
      ? JSON.stringify({ state: "paused" })
      : action === "resume"
        ? JSON.stringify({ state: "printing" })
        : undefined;
    const res = await fetch(url, { method, headers, body, signal });
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
  } else if (apiType === "moonraker") {
    const endpoint = action === "pause"
      ? "/printer/print/pause"
      : action === "resume"
        ? "/printer/print/resume"
        : "/printer/print/cancel";
    const res = await fetch(`${base}${endpoint}`, { method: "POST", headers, signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } else {
    // OctoPrint
    const command = action === "pause" ? "pause" : action === "resume" ? "resume" : "cancel";
    const res = await fetch(`${base}/api/job`, {
      method: "POST",
      headers,
      body: JSON.stringify({ command }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
