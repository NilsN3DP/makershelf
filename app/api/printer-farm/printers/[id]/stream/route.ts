import { spawn } from "node:child_process";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOUNDARY = "mjpegframe";

/**
 * Parse all complete JPEG frames out of a buffer.
 * JPEG SOI = FF D8, EOI = FF D9. Each frame is a self-contained JPEG file.
 * Returns extracted frames and the leftover bytes (incomplete trailing frame).
 */
function extractFrames(buf: Buffer): { frames: Buffer[]; tail: Buffer } {
  const frames: Buffer[] = [];
  let pos = 0;
  while (pos < buf.length - 1) {
    const soi = buf.indexOf(Buffer.from([0xff, 0xd8]), pos);
    if (soi === -1) { pos = buf.length; break; }
    const eoi = buf.indexOf(Buffer.from([0xff, 0xd9]), soi + 2);
    if (eoi === -1) { pos = soi; break; }
    frames.push(buf.subarray(soi, eoi + 2));
    pos = eoi + 2;
  }
  return { frames, tail: buf.subarray(pos) };
}

/**
 * GET /api/printer-farm/printers/[id]/stream
 *
 * Server-side RTSP → MJPEG transcoding proxy.
 * Reads the printer's webcamUrl (must be rtsp://…), spawns ffmpeg to decode
 * the stream and re-encode as JPEG frames, and sends them to the browser as
 * multipart/x-mixed-replace — the standard format for MJPEG-over-HTTP.
 *
 * The browser renders it in a plain <img> tag; no plugins needed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { id } = await params;
  const printer = await prisma.printerFarmPrinter.findFirst({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
      ownerUserId: access.session.userId,
    },
  });

  const rtspUrl = printer?.webcamUrl;
  if (!rtspUrl?.startsWith("rtsp://")) {
    return new Response("No RTSP stream configured for this printer.", { status: 404 });
  }

  const enc = new TextEncoder();
  let ffmpegProc: ReturnType<typeof spawn> | null = null;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      ffmpegProc = spawn("ffmpeg", [
        "-loglevel", "error",
        "-rtsp_transport", "tcp",   // TCP is more reliable than UDP on LAN
        "-i", rtspUrl,
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
        "-q:v", "4",                // JPEG quality 1–31, lower = better (4 is sharp)
        "-r", "10",                 // 10 fps — smooth enough, low CPU
        "pipe:1",
      ]);

      let buf = Buffer.alloc(0);

      ffmpegProc.stdout?.on("data", (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        const { frames, tail } = extractFrames(buf);
        buf = tail;
        for (const frame of frames) {
          const head = enc.encode(
            `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`,
          );
          try {
            controller.enqueue(head);
            controller.enqueue(frame);
            controller.enqueue(enc.encode("\r\n"));
          } catch {
            // Client disconnected — cancel will handle cleanup
            break;
          }
        }
      });

      ffmpegProc.on("error", () => {
        try { controller.close(); } catch { /* already closed */ }
      });
      ffmpegProc.on("close", () => {
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      ffmpegProc?.kill("SIGTERM");
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      "Cache-Control": "no-cache, no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",   // prevent nginx from buffering the stream
    },
  });
}
