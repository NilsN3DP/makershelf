import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";

const materialSchema = z.object({
  name: z.string().min(1).max(120),
  material: z.string().min(1).max(120),
  deviceType: z.enum(["laser", "plotter"]).default("laser"),
  laserType: z.string().max(60).default("CO2"),
  powerPct: z.number().int().min(0).max(100).default(80),
  speedMmMin: z.number().int().min(1).max(100000).default(500),
  passes: z.number().int().min(1).max(50).default(1),
  intervalMm: z.number().positive().max(100).optional().nullable(),
  airAssist: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

function ensureEnabled(settingsJson: unknown, deviceType: string) {
  const settings = resolveWorkspaceSettings(settingsJson);
  const ok = deviceType === "plotter" ? settings.plotterEnabled : settings.laserEnabled;
  return ok ? { ok: true as const } : {
    ok: false as const,
    response: NextResponse.json({ error: "Modul ist nicht aktiviert." }, { status: 403 }),
  };
}

export async function GET(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const deviceType = url.searchParams.get("deviceType") ?? "laser";

  const enabled = ensureEnabled(access.membership.workspace.settingsJson, deviceType);
  if (!enabled.ok) return enabled.response;

  const materials = await prisma.laserMaterialProfile.findMany({
    where: {
      workspaceId: access.membership.workspaceId,
      ownerUserId: access.session.userId,
      deviceType,
    },
    orderBy: [{ material: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ materials });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  let body;
  try {
    body = materialSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const enabled = ensureEnabled(access.membership.workspace.settingsJson, body.deviceType);
  if (!enabled.ok) return enabled.response;

  const profile = await prisma.laserMaterialProfile.create({
    data: {
      workspaceId: access.membership.workspaceId,
      ownerUserId: access.session.userId,
      deviceType: body.deviceType,
      name: body.name.trim(),
      material: body.material.trim(),
      laserType: body.laserType.trim(),
      powerPct: body.powerPct,
      speedMmMin: body.speedMmMin,
      passes: body.passes,
      intervalMm: body.intervalMm ?? null,
      airAssist: body.airAssist,
      notes: body.notes?.trim() || "",
    },
  });

  return NextResponse.json({ profile }, { status: 201 });
}
