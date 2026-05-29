import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { path7z } from "7zip-bin-full";
import { NextResponse } from "next/server";

import { isSupportedArchiveFile } from "@/src/lib/archive-file-core";
import { detectFileType, getExtension, isSupportedPrintFile } from "@/src/lib/makershelf-data";
import { guessProjectMimeType } from "@/src/lib/server/archive-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const MAX_EXTRACTED_FILES = 500;
const MAX_RESPONSE_BYTES = 500 * 1024 * 1024;

function resolve7zPath() {
  const candidates = [
    process.env.SEVENZIP_PATH,
    path7z,
    process.platform === "win32"
      ? path.join(process.cwd(), "node_modules", "7zip-bin-full", "win", "x64", "7z.exe")
      : path.join(process.cwd(), "node_modules", "7zip-bin-full", "linux", "x64", "7zz"),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(candidate)) ?? path7z;
}

function cleanArchiveName(name: string) {
  const baseName = path.basename(name.replace(/\\/g, "/"));
  return baseName.replace(/[^\w .()+\-[\]]+/g, "_") || "archive";
}

function isWithin(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function collectExtractedFiles(root: string, current: string, files: Array<{ absolutePath: string; relativePath: string }>) {
  let skipped = 0;
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (!isWithin(root, absolutePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      skipped += await collectExtractedFiles(root, absolutePath, files);
      continue;
    }

    if (!entry.isFile() || !isSupportedPrintFile(entry.name)) {
      skipped += 1;
      continue;
    }

    files.push({
      absolutePath,
      relativePath: path.relative(root, absolutePath).replace(/\\/g, "/"),
    });
  }

  return skipped;
}

export async function POST(request: Request) {
  let tempRoot = "";

  try {
    const formData = await request.formData();
    const archive = formData.get("archive");

    if (!(archive instanceof File) || archive.size === 0) {
      return NextResponse.json({ error: "Kein Archiv übergeben." }, { status: 400 });
    }

    if (!isSupportedArchiveFile(archive.name)) {
      return NextResponse.json({ error: `Nicht unterstütztes Archivformat: .${getExtension(archive.name)}` }, { status: 400 });
    }

    tempRoot = await mkdtemp(path.join(os.tmpdir(), "makershelf-archive-"));
    const inputDir = path.join(tempRoot, "input");
    const outputDir = path.join(tempRoot, "output");
    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const archivePath = path.join(inputDir, cleanArchiveName(archive.name));
    await writeFile(archivePath, Buffer.from(await archive.arrayBuffer()));

    await execFileAsync(resolve7zPath(), ["x", archivePath, `-o${outputDir}`, "-y", "-bd"], {
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });

    const extracted: Array<{ absolutePath: string; relativePath: string }> = [];
    const skipped = await collectExtractedFiles(outputDir, outputDir, extracted);

    if (extracted.length > MAX_EXTRACTED_FILES) {
      return NextResponse.json(
        { error: `Archiv enthält zu viele unterstützte Dateien (${extracted.length}). Limit: ${MAX_EXTRACTED_FILES}.` },
        { status: 413 },
      );
    }

    let totalBytes = 0;
    const files = [];

    for (const item of extracted) {
      const data = await readFile(item.absolutePath);
      totalBytes += data.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        return NextResponse.json(
          { error: "Die entpackten Dateien sind für den Browser-Import zu groß. Bitte lege das Archiv in den Server-Importordner." },
          { status: 413 },
        );
      }

      files.push({
        name: item.relativePath,
        type: detectFileType(item.relativePath),
        mimeType: guessProjectMimeType(item.relativePath),
        data: Array.from(data),
      });
    }

    return NextResponse.json({
      files,
      skipped,
      archiveName: archive.name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Archiv konnte nicht entpackt werden: ${error.message}`
            : "Archiv konnte nicht entpackt werden.",
      },
      { status: 400 },
    );
  } finally {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
