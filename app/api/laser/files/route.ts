import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { resolveWorkspaceSettings } from "@/src/lib/server/workspace-settings";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

const LASER_EXTENSIONS = new Set(["svg", "ai", "pdf", "eps", "gcode"]);
const PLOTTER_EXTENSIONS = new Set(["plt", "hpgl", "dxf", "svg"]);
const ALL_EXTENSIONS = new Set([...LASER_EXTENSIONS, ...PLOTTER_EXTENSIONS]);
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

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
        response: NextResponse.json(
          { error: deviceType === "plotter" ? "Plotter-Modul ist nicht aktiviert." : "Laser-Modul ist nicht aktiviert." },
          { status: 403 },
        ),
      };
}

export async function GET(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const deviceType = url.searchParams.get("deviceType") ?? "laser";

  const enabled = ensureEnabled(access.membership.workspace.settingsJson, deviceType);
  if (!enabled.ok) return enabled.response;

  const files = await prisma.laserFile.findMany({
    where: {
      workspaceId: access.membership.workspaceId,
      ownerUserId: access.session.userId,
      deviceType,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ files });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten." }, { status: 400 });
  }

  const deviceType = (formData.get("deviceType") as string | null) ?? "laser";
  const enabled = ensureEnabled(access.membership.workspace.settingsJson, deviceType);
  if (!enabled.ok) return enabled.response;

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "Keine Datei übergeben." }, { status: 400 });
  }

  const ext = fileEntry.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALL_EXTENSIONS.has(ext)) {
    return NextResponse.json({
      error: `Dateityp nicht unterstützt. Erlaubt: ${[...ALL_EXTENSIONS].join(", ")}`,
    }, { status: 400 });
  }

  if (fileEntry.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Datei zu groß (max. 50 MB)." }, { status: 400 });
  }

  const tagsRaw = formData.get("tags");
  const tags = tagsRaw ? (JSON.parse(tagsRaw.toString()) as string[]) : [];
  const notes = (formData.get("notes") as string | null) ?? "";

  const storageRoot = laserStorageRoot();
  await fs.mkdir(storageRoot, { recursive: true });

  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const storedName = `${fileId}.${ext}`;
  const storedPath = path.join(storageRoot, storedName);

  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  await fs.writeFile(storedPath, buffer);

  const file = await prisma.laserFile.create({
    data: {
      workspaceId: access.membership.workspaceId,
      ownerUserId: access.session.userId,
      deviceType,
      name: fileEntry.name,
      originalName: fileEntry.name,
      fileType: ext,
      sizeBytes: BigInt(fileEntry.size),
      storedPath: `Laser/${storedName}`,
      tags,
      notes: notes.trim(),
    },
  });

  return NextResponse.json({ file: { ...file, sizeBytes: file.sizeBytes.toString() } }, { status: 201 });
}
