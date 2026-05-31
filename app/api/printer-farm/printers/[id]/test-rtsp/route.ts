import { createConnection } from "node:net";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/printer-farm/printers/[id]/test-rtsp
 *
 * Diagnostic endpoint — tests TCP reachability of the printer's webcamUrl
 * from inside the server/container. Returns JSON with host, port, and result.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const printer = await prisma.printerFarmPrinter.findFirst({
    where: { id, workspaceId: access.membership.workspaceId },
    select: { webcamUrl: true },
  });

  const webcamUrl = printer?.webcamUrl;
  if (!webcamUrl) {
    return Response.json({ error: "No webcamUrl configured" }, { status: 404 });
  }

  // Parse host and port from the URL
  let host: string;
  let port: number;
  try {
    // rtsp://host/path → add http:// prefix for URL parsing
    const u = new URL(webcamUrl.replace(/^rtsp:\/\//i, "http://"));
    host = u.hostname;
    port = u.port ? parseInt(u.port, 10) : 554; // RTSP default port
  } catch {
    return Response.json({ error: "Invalid webcamUrl", webcamUrl }, { status: 400 });
  }

  const start = Date.now();
  const result = await new Promise<{ ok: boolean; ms: number; error?: string }>((resolve) => {
    const socket = createConnection({ host, port, timeout: 5000 }, () => {
      socket.destroy();
      resolve({ ok: true, ms: Date.now() - start });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, ms: Date.now() - start, error: "timeout after 5000ms" });
    });
    socket.on("error", (err) => {
      resolve({ ok: false, ms: Date.now() - start, error: err.message });
    });
  });

  // Also try ffmpeg --version to confirm it's installed
  let ffmpegInstalled = false;
  try {
    const { execSync } = await import("node:child_process");
    execSync("ffmpeg -version", { timeout: 3000, stdio: "pipe" });
    ffmpegInstalled = true;
  } catch { /* not installed or failed */ }

  return Response.json({
    webcamUrl,
    host,
    port,
    tcp: result,
    ffmpegInstalled,
    serverIp: process.env.HOSTNAME ?? "unknown",
  });
}
