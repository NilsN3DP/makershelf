/**
 * Public tag lookup endpoint: GET /api/filament/tag/:id
 *
 * Returns the spool as an OpenPrintTag JSON payload so that any device that
 * scans a tag written by this app instance can retrieve the full filament data.
 * Lookup matches on both the spool's primary `id` and its `openPrintTagId`.
 *
 * Access: workspace auth required (the scanning device must be logged into the
 * same makershelf instance). Cross-instance lookups are handled by the public
 * scan API — see /api/filament/scan for remote URL fetching.
 */

import { NextResponse } from "next/server";

import { buildOpenPrintTagPayload } from "@/src/lib/filament-core.mjs";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.filamentVaultEnabled) {
    return NextResponse.json({ error: "Filament Vault ist nicht aktiviert." }, { status: 403 });
  }

  // Match on spool id OR openPrintTagId
  const spool = await prisma.filamentSpool.findFirst({
    where: {
      workspaceId: access.membership.workspaceId,
      OR: [{ id }, { openPrintTagId: id }],
    },
  });

  if (!spool) {
    return NextResponse.json({ error: "Spule nicht gefunden." }, { status: 404 });
  }

  const payload = buildOpenPrintTagPayload(spool);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
