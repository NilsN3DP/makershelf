import { NextResponse } from "next/server";
import { z } from "zod";

import type { AppSettings } from "@/src/lib/makershelf-data";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { mergeWorkspaceSettings, resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const settingsPatchSchema = z.object({
  userName: z.string().max(120).optional(),
  language: z.enum(["de", "en"]).optional(),
  themeMode: z.enum(["system", "light", "dark"]).optional(),
  primaryColor: z.string().max(40).optional(),
  secondaryColor: z.string().max(40).optional(),
  preferredSlicer: z.enum(["prusa", "orca", "bambu"]).optional(),
  storageMode: z.enum(["browser", "project-folders", "custom-path"]).optional(),
  storagePath: z.string().max(1000).optional(),
  windowsLibraryPath: z.string().max(1000).optional(),
  debugMode: z.boolean().optional(),
  showBuyMeACoffeeButton: z.boolean().optional(),
  buyMeACoffeeUrl: z.string().max(1000).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
  dashboardFeaturedCount: z.number().int().min(1).max(100).optional(),
  maxPreviewFileSizeMb: z.number().int().min(1).max(10000).optional(),
  enableExperimentalWebsiteImport: z.boolean().optional(),
  prusaLinkEnabled: z.boolean().optional(),
  prusaLinkUrl: z.string().max(1000).optional(),
  prusaLinkApiKey: z.string().max(2000).optional(),
  filamentVaultEnabled: z.boolean().optional(),
  filamentOpenPrintTagEnabled: z.boolean().optional(),
  filamentTagBaseUrl: z.string().max(1000).optional(),
  filamentLowThresholdGrams: z.number().int().min(0).max(100000).optional(),
  filamentDefaultTareGrams: z.number().int().min(0).max(100000).optional(),
  printerFarmEnabled: z.boolean().optional(),
  printToolsEnabled: z.boolean().optional(),
  laserEnabled: z.boolean().optional(),
  plotterEnabled: z.boolean().optional(),
  lightburnBridgeUrl: z.string().max(1000).optional(),
});

export async function PATCH(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canManageSettings) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const parsed = settingsPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Einstellungen." }, { status: 400 });
  }

  const body = parsed.data satisfies Partial<AppSettings>;
  const settingsJson = mergeWorkspaceSettings(access.membership.workspace.settingsJson, body);

  const workspace = await prisma.workspace.update({
    where: { id: access.membership.workspaceId },
    data: {
      language: body.language,
      themeMode: body.themeMode,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      settingsJson,
    },
    select: { settingsJson: true },
  });

  return NextResponse.json({
    ok: true,
    settings: resolveWorkspaceSettings(workspace.settingsJson),
  });
}
