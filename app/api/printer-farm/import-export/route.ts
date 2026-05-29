import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

export const dynamic = "force-dynamic";

const importedGroupSchema = z
  .object({ name: z.string().min(1).max(120), color: z.string().default("#6366f1") })
  .nullable()
  .optional();

const printerImportSchema = z.array(
  z.object({
    name: z.string().min(1).max(120),
    model: z.string().max(120).optional().nullable(),
    location: z.string().max(120).optional().nullable(),
    apiType: z.enum(["prusa-link", "moonraker", "octoprint"]).default("prusa-link"),
    apiUrl: z.string().min(1).max(500),
    apiKey: z.string().max(500).optional().nullable(),
    webcamUrl: z.string().max(500).optional().nullable(),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    tags: z.array(z.string()).optional().default([]),
    notes: z.string().optional().default(""),
    group: importedGroupSchema,
  }),
);

function ensureEnabled(settingsJson: unknown) {
  const settings = resolveWorkspaceSettings(settingsJson);
  return settings.printerFarmEnabled
    ? { ok: true as const }
    : {
        ok: false as const,
        response: NextResponse.json({ error: "Drucker Farm ist nicht aktiviert." }, { status: 403 }),
      };
}

// ─── GET — export all printers ────────────────────────────────────────────────

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const enabled = ensureEnabled(access.membership.workspace.settingsJson);
  if (!enabled.ok) return enabled.response;

  const printers = await prisma.printerFarmPrinter.findMany({
    where: { workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId },
    include: { group: { select: { name: true, color: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const exportData = printers.map((p) => ({
    name: p.name,
    model: p.model,
    location: p.location,
    apiType: p.apiType,
    apiUrl: p.apiUrl,
    apiKey: p.apiKey,
    webcamUrl: p.webcamUrl,
    active: p.active,
    sortOrder: p.sortOrder,
    tags: p.tags,
    notes: p.notes,
    group: p.group ? { name: p.group.name, color: p.group.color } : null,
  }));

  const ts = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="makershelf-drucker-farm-${ts}.json"`,
    },
  });
}

// ─── POST — import printers from JSON ─────────────────────────────────────────

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const enabled = ensureEnabled(access.membership.workspace.settingsJson);
  if (!enabled.ok) return enabled.response;

  let body: z.infer<typeof printerImportSchema>;
  try {
    body = printerImportSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültiges Format.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const { workspaceId, ownerUserId: userId } = { workspaceId: access.membership.workspaceId, ownerUserId: access.session.userId };

  // Cache group name → id to avoid duplicate creates within this import
  const groupCache = new Map<string, string>();

  async function resolveGroupId(groupName: string, groupColor: string): Promise<string> {
    const cached = groupCache.get(groupName);
    if (cached) return cached;

    const existing = await prisma.printerFarmGroup.findFirst({
      where: { workspaceId, ownerUserId: userId, name: groupName },
      select: { id: true },
    });
    if (existing) { groupCache.set(groupName, existing.id); return existing.id; }

    const created = await prisma.printerFarmGroup.create({
      data: { workspaceId, ownerUserId: userId, name: groupName, color: groupColor || "#6366f1" },
    });
    groupCache.set(groupName, created.id);
    return created.id;
  }

  let created = 0;
  const skipped: string[] = [];

  for (const entry of body) {
    try {
      let groupId: string | null = null;
      if (entry.group?.name) {
        groupId = await resolveGroupId(entry.group.name, entry.group.color ?? "#6366f1");
      }

      await prisma.printerFarmPrinter.create({
        data: {
          workspaceId,
          ownerUserId: userId,
          name: entry.name.trim(),
          model: entry.model?.trim() || null,
          location: entry.location?.trim() || null,
          groupId,
          apiType: entry.apiType,
          apiUrl: entry.apiUrl.trim().replace(/\/$/, ""),
          apiKey: entry.apiKey?.trim() || null,
          webcamUrl: entry.webcamUrl?.trim() || null,
          active: entry.active,
          sortOrder: entry.sortOrder,
          tags: entry.tags,
          notes: entry.notes?.trim() ?? "",
        },
      });
      created++;
    } catch {
      skipped.push(entry.name);
    }
  }

  return NextResponse.json({ created, skipped, total: body.length });
}
