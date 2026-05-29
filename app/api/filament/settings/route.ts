import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { mergeWorkspaceSettings, resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const settingsSchema = z.object({
  filamentVaultEnabled: z.boolean().optional(),
  filamentOpenPrintTagEnabled: z.boolean().optional(),
  filamentTagBaseUrl: z.string().max(300).optional(),
  filamentLowThresholdGrams: z.coerce.number().int().min(0).max(5000).optional(),
  filamentDefaultTareGrams: z.coerce.number().int().min(0).max(5000).optional(),
});

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const settings = resolveWorkspaceSettings(access.membership.workspace.settingsJson);
  return NextResponse.json({
    filamentVaultEnabled: settings.filamentVaultEnabled,
    filamentOpenPrintTagEnabled: settings.filamentOpenPrintTagEnabled,
    filamentTagBaseUrl: settings.filamentTagBaseUrl,
    filamentLowThresholdGrams: settings.filamentLowThresholdGrams,
    filamentDefaultTareGrams: settings.filamentDefaultTareGrams,
  });
}

export async function PATCH(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  if (access.permissions.isReadOnly || !access.permissions.canManageSettings) {
    return NextResponse.json({ error: "Keine Berechtigung fuer Filament-Einstellungen." }, { status: 403 });
  }

  const body = settingsSchema.parse(await request.json());
  const settingsJson = mergeWorkspaceSettings(access.membership.workspace.settingsJson, body);
  const workspace = await prisma.workspace.update({
    where: { id: access.membership.workspaceId },
    data: { settingsJson },
  });

  const settings = resolveWorkspaceSettings(workspace.settingsJson);
  return NextResponse.json({
    filamentVaultEnabled: settings.filamentVaultEnabled,
    filamentOpenPrintTagEnabled: settings.filamentOpenPrintTagEnabled,
    filamentTagBaseUrl: settings.filamentTagBaseUrl,
    filamentLowThresholdGrams: settings.filamentLowThresholdGrams,
    filamentDefaultTareGrams: settings.filamentDefaultTareGrams,
  });
}
