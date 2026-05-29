import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const printerSchema = z.object({
  name: z.string().min(1).max(120),
  model: z.string().max(120).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  groupId: z.string().optional().nullable(),
  tags: z.array(z.string().max(60)).optional().default([]),
  apiType: z.enum(["prusa-link", "moonraker", "octoprint"]).default("prusa-link"),
  apiUrl: z.string().min(1).max(500),
  apiKey: z.string().max(500).optional().nullable(),
  webcamUrl: z.string().max(500).optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  notes: z.string().max(2000).optional().nullable(),
});

function ensureEnabled(settingsJson: unknown) {
  const settings = resolveWorkspaceSettings(settingsJson);
  return settings.printerFarmEnabled
    ? { ok: true as const }
    : {
        ok: false as const,
        response: NextResponse.json(
          { error: "Drucker Farm ist nicht aktiviert." },
          { status: 403 },
        ),
      };
}

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const enabled = ensureEnabled(access.membership.workspace.settingsJson);
  if (!enabled.ok) return enabled.response;

  const printers = await prisma.printerFarmPrinter.findMany({
    where: {
      workspaceId: access.membership.workspaceId,
      ownerUserId: access.session.userId,
    },
    include: {
      group: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ printers });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const enabled = ensureEnabled(access.membership.workspace.settingsJson);
  if (!enabled.ok) return enabled.response;

  let body;
  try {
    body = printerSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const printer = await prisma.printerFarmPrinter.create({
    data: {
      workspaceId: access.membership.workspaceId,
      ownerUserId: access.session.userId,
      name: body.name.trim(),
      model: body.model?.trim() || null,
      location: body.location?.trim() || null,
      groupId: body.groupId || null,
      tags: body.tags,
      apiType: body.apiType,
      apiUrl: body.apiUrl.trim().replace(/\/$/, ""),
      apiKey: body.apiKey?.trim() || null,
      webcamUrl: body.webcamUrl?.trim() || null,
      active: body.active,
      sortOrder: body.sortOrder,
      notes: body.notes?.trim() || "",
    },
    include: { group: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json({ printer }, { status: 201 });
}
