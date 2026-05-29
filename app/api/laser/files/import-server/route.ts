import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";
import { resolveImportPath } from "@/src/lib/server/import-root";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

const LASER_EXTENSIONS = new Set(["svg", "ai", "pdf", "eps", "gcode"]);
const PLOTTER_EXTENSIONS = new Set(["plt", "hpgl", "dxf", "svg"]);
const ALL_EXTENSIONS = new Set([...LASER_EXTENSIONS, ...PLOTTER_EXTENSIONS]);

function laserStorageRoot(): string {
  const runtimeConfig = getRuntimeConfig();
  const storageRoot = runtimeConfig.storageRoot?.trim()
    ? path.resolve(runtimeConfig.storageRoot)
    : path.resolve(process.cwd(), ".makershelf-storage");
  return path.join(storageRoot, "Laser");
}

function ensureEnabled(settingsJson: unknown, deviceType: string) {
  const settings = resolveWorkspaceSettings(settingsJson);
  const ok = deviceType === "plotter" ? settings.plotterEnabled : settings.laserEnabled;
  return ok
    ? { ok: true as const }
    : {
        ok: false as const,
        response: NextResponse.json({ error: "Modul ist nicht aktiviert." }, { status: 403 }),
      };
}

const importEntrySchema = z.object({
  sourcePath: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

const importSchema = z.object({
  deviceType: z.enum(["laser", "plotter"]).default("laser"),
  files: z.array(importEntrySchema).min(1).max(500),
});

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  if (access.permissions.isReadOnly || !access.permissions.canUpload) {
    return NextResponse.json({ error: "Keine Upload-Berechtigung." }, { status: 403 });
  }

  let body: z.infer<typeof importSchema>;
  try {
    body = importSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe.", details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const enabled = ensureEnabled(access.membership.workspace.settingsJson, body.deviceType);
  if (!enabled.ok) return enabled.response;

  const storageRoot = laserStorageRoot();
  await fs.mkdir(storageRoot, { recursive: true });

  const created: Array<{ id: string; name: string }> = [];
  const errors: Array<{ sourcePath: string; error: string }> = [];

  for (const entry of body.files) {
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALL_EXTENSIONS.has(ext)) {
      errors.push({ sourcePath: entry.sourcePath, error: `Dateityp .${ext} nicht unterstützt.` });
      continue;
    }

    try {
      const sourceAbsPath = resolveImportPath(entry.sourcePath);
      const buffer = await fs.readFile(sourceAbsPath);

      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const storedName = `${fileId}.${ext}`;
      await fs.writeFile(path.join(storageRoot, storedName), buffer);

      const record = await prisma.laserFile.create({
        data: {
          workspaceId: access.membership.workspaceId,
          ownerUserId: access.session.userId,
          deviceType: body.deviceType,
          name: entry.name,
          originalName: entry.name,
          fileType: ext,
          sizeBytes: BigInt(buffer.length),
          storedPath: `Laser/${storedName}`,
          tags: entry.tags,
          notes: entry.notes.trim(),
        },
      });
      created.push({ id: record.id, name: record.name });
    } catch (err) {
      errors.push({
        sourcePath: entry.sourcePath,
        error: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
    }
  }

  return NextResponse.json({ created, errors }, created.length ? { status: 201 } : { status: 400 });
}
