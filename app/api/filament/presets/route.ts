import { NextResponse } from "next/server";

import { filamentManufacturerPresets } from "@/src/lib/filament-presets.mjs";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  if (!settings.filamentVaultEnabled) {
    return NextResponse.json({ error: "Filament Vault ist nicht aktiviert." }, { status: 403 });
  }

  return NextResponse.json({ manufacturers: filamentManufacturerPresets });
}
