import { prisma } from "@/src/lib/server/prisma";
import { fetchWithDigestAuth } from "@/src/lib/server/digest-auth";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/printer-farm/printers/[id]/snapshot
 *
 * Server-side proxy for the PrusaLink camera snapshot endpoint.
 * Fetches GET /api/v1/snapshot from the printer using Digest auth and pipes
 * the JPEG back to the browser — no CORS or auth issues on the client side.
 * The UI requests this every ~10 s to display a near-live preview.
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

  if (!printer?.apiUrl) {
    return new Response("Printer not found", { status: 404 });
  }

  const base = printer.apiUrl.trim().replace(/\/$/, "");
  const snapshotUrl = `${base}/api/v1/snapshot`;
  const apiKey = printer.apiKey?.trim() ?? "";

  try {
    const resp = apiKey
      ? await fetchWithDigestAuth(snapshotUrl, { signal: AbortSignal.timeout(8000) }, "maker", apiKey)
      : await fetch(snapshotUrl, { signal: AbortSignal.timeout(8000) });

    if (!resp.ok) {
      return new Response(`Camera unavailable (printer returned HTTP ${resp.status})`, { status: 503 });
    }

    const image = await resp.arrayBuffer();
    return new Response(image, {
      headers: {
        "Content-Type": resp.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch {
    return new Response("Camera unavailable", { status: 503 });
  }
}
