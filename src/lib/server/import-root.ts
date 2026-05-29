import path from "node:path";
import { promises as fs } from "node:fs";

import { getRuntimeConfig } from "@/src/lib/runtime-config";
import { detectFileType, isSupportedIndexingFile } from "@/src/lib/makershelf-data";

const DEFAULT_IMPORT_ROOT = "import";
const IMAGE_PATTERN = /\.(png|jpe?g|webp|gif|bmp)$/i;
const METADATA_PATTERN = /\.(pdf|url|webloc|txt|md)$/i;
const MAX_SCAN_FILES = 20000;

export type ServerImportFile = {
  sourcePath: string;
  name: string;
  relativePath: string;
  sizeBytes: number;
  mimeType: string;
  type: string;
  lastModified: number;
  kind: "print" | "image" | "metadata";
};

export type ServerImportScanProgress = {
  currentPath: string;
  entriesVisited: number;
  directoriesVisited: number;
  filesMatched: number;
};

export type ServerImportFolderSummary = {
  path: string;
  name: string;
  depth: number;
  countsKnown: boolean;
  printFileCount: number;
  imageFileCount: number;
  metadataFileCount: number;
  totalSizeBytes: number;
  lastModified: number;
};

type ScanImportRootOptions = {
  onProgress?: (progress: ServerImportScanProgress) => void | Promise<void>;
  rootPaths?: string[];
};

export function getImportRoot() {
  const runtimeConfig = getRuntimeConfig();
  return path.resolve(runtimeConfig.importRoot?.trim() || DEFAULT_IMPORT_ROOT);
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function resolveImportPath(relativePath: string) {
  const root = getImportRoot();
  const normalized = normalizeRelativePath(relativePath);
  const resolved = path.resolve(root, normalized);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Importpfad liegt ausserhalb des konfigurierten Import-Ordners.");
  }

  return resolved;
}

async function pruneEmptyImportDirectories(root: string, startDirectory: string) {
  let current = path.resolve(startDirectory);

  while (current !== root && current.startsWith(`${root}${path.sep}`)) {
    try {
      const remainingEntries = await fs.readdir(current);
      if (remainingEntries.length > 0) {
        return;
      }
      await fs.rmdir(current);
      current = path.dirname(current);
    } catch {
      return;
    }
  }
}

export async function removeImportedSourceFiles(relativePaths: string[]) {
  const root = getImportRoot();
  const deleted: string[] = [];
  const cleanupErrors: string[] = [];
  const uniquePaths = Array.from(new Set(relativePaths.map(normalizeRelativePath).filter(Boolean)));

  for (const relativePath of uniquePaths) {
    try {
      const absolutePath = resolveImportPath(relativePath);
      await fs.unlink(absolutePath);
      deleted.push(relativePath);
      await pruneEmptyImportDirectories(root, path.dirname(absolutePath));
    } catch (error) {
      cleanupErrors.push(
        `${relativePath}: ${error instanceof Error ? error.message : "Quelle konnte nicht geloescht werden."}`,
      );
    }
  }

  return { deleted, cleanupErrors };
}

export async function removeImportedSourceDirectories(relativePaths: string[]) {
  const root = getImportRoot();
  const deletedDirectories: string[] = [];
  const cleanupErrors: string[] = [];
  const uniquePaths = Array.from(new Set(relativePaths.map(normalizeRelativePath).filter(Boolean)));

  for (const relativePath of uniquePaths) {
    try {
      const absolutePath = resolveImportPath(relativePath);
      if (absolutePath === root) {
        cleanupErrors.push(`${relativePath}: Import-Wurzel wird aus Sicherheitsgründen nicht gelöscht.`);
        continue;
      }

      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        continue;
      }

      await fs.rm(absolutePath, { recursive: true, force: true });
      deletedDirectories.push(relativePath);
      await pruneEmptyImportDirectories(root, path.dirname(absolutePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      cleanupErrors.push(
        `${relativePath}: ${error instanceof Error ? error.message : "Quellordner konnte nicht geloescht werden."}`,
      );
    }
  }

  return { deletedDirectories, cleanupErrors };
}

function resolveImportScanRoot(root: string, relativePath: string) {
  const normalized = normalizeRelativePath(relativePath);
  const resolved = path.resolve(root, normalized || ".");

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Importpfad liegt ausserhalb des konfigurierten Import-Ordners.");
  }

  return resolved;
}

function guessMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".url")) return "text/plain";
  return "application/octet-stream";
}

function classifyImportFile(fileName: string): ServerImportFile["kind"] | null {
  if (isSupportedIndexingFile(fileName)) return "print";
  if (IMAGE_PATTERN.test(fileName)) return "image";
  if (METADATA_PATTERN.test(fileName)) return "metadata";
  return null;
}

async function walkImportRoot(
  root: string,
  current: string,
  files: ServerImportFile[],
  progress: ServerImportScanProgress,
  options: ScanImportRootOptions,
) {
  if (files.length >= MAX_SCAN_FILES) {
    return;
  }

  progress.currentPath = normalizeRelativePath(path.relative(root, current)) || ".";
  progress.directoriesVisited += 1;
  await options.onProgress?.({ ...progress });

  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    progress.entriesVisited += 1;
    progress.currentPath = normalizeRelativePath(path.relative(root, absolutePath));
    await options.onProgress?.({ ...progress });

    if (entry.isDirectory()) {
      await walkImportRoot(root, absolutePath, files, progress, options);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const kind = classifyImportFile(entry.name);
    if (!kind) {
      continue;
    }

    const stats = await fs.stat(absolutePath);
    const relativePath = normalizeRelativePath(path.relative(root, absolutePath));
    progress.currentPath = relativePath;
    progress.filesMatched += 1;
    files.push({
      sourcePath: relativePath,
      name: entry.name,
      relativePath,
      sizeBytes: stats.size,
      mimeType: guessMimeType(entry.name),
      type: detectFileType(entry.name),
      lastModified: stats.mtimeMs,
      kind,
    });
    await options.onProgress?.({ ...progress });

    if (files.length >= MAX_SCAN_FILES) {
      return;
    }
  }
}

function getSummaryPath(relativePath: string) {
  const segments = normalizeRelativePath(relativePath).split("/").filter(Boolean);
  return segments[0] || ".";
}

function getSummaryDepth(relativePath: string) {
  if (relativePath === ".") {
    return 0;
  }

  return normalizeRelativePath(relativePath).split("/").filter(Boolean).length;
}

function updateFolderSummary(
  summaries: Map<string, ServerImportFolderSummary>,
  file: ServerImportFile,
) {
  const summaryPath = getSummaryPath(file.relativePath);
  const current =
    summaries.get(summaryPath) ??
    {
      path: summaryPath,
      name: summaryPath === "." ? "Root Import" : path.basename(summaryPath),
      depth: getSummaryDepth(summaryPath),
      countsKnown: true,
      printFileCount: 0,
      imageFileCount: 0,
      metadataFileCount: 0,
      totalSizeBytes: 0,
      lastModified: 0,
    };

  if (file.kind === "print") {
    current.printFileCount += 1;
  } else if (file.kind === "image") {
    current.imageFileCount += 1;
  } else {
    current.metadataFileCount += 1;
  }

  current.totalSizeBytes += file.sizeBytes;
  current.lastModified = Math.max(current.lastModified, file.lastModified);
  summaries.set(summaryPath, current);
}

async function readShallowImportFolderSummaries(
  root: string,
  current: string,
  summaries: Map<string, ServerImportFolderSummary>,
  progress: ServerImportScanProgress,
  options: ScanImportRootOptions,
  depth = 0,
) {
  progress.currentPath = normalizeRelativePath(path.relative(root, current)) || ".";
  progress.directoriesVisited += 1;
  await options.onProgress?.({ ...progress });

  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    progress.entriesVisited += 1;
    progress.currentPath = normalizeRelativePath(path.relative(root, absolutePath));
    await options.onProgress?.({ ...progress });

    if (entry.isDirectory()) {
      const stats = await fs.stat(absolutePath);
      const relativePath = normalizeRelativePath(path.relative(root, absolutePath));
      summaries.set(relativePath, {
        path: relativePath,
        name: entry.name,
        depth: getSummaryDepth(relativePath),
        countsKnown: false,
        printFileCount: 0,
        imageFileCount: 0,
        metadataFileCount: 0,
        totalSizeBytes: 0,
        lastModified: stats.mtimeMs,
      });

      if (depth < 1) {
        await readShallowImportFolderSummaries(
          root,
          absolutePath,
          summaries,
          progress,
          options,
          depth + 1,
        );
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const kind = classifyImportFile(entry.name);
    if (!kind) {
      continue;
    }

    const stats = await fs.stat(absolutePath);
    const relativePath = normalizeRelativePath(path.relative(root, absolutePath));
    progress.currentPath = relativePath;
    progress.filesMatched += 1;
    updateFolderSummary(summaries, {
      sourcePath: relativePath,
      name: entry.name,
      relativePath,
      sizeBytes: stats.size,
      mimeType: guessMimeType(entry.name),
      type: detectFileType(entry.name),
      lastModified: stats.mtimeMs,
      kind,
    });
    const rootSummary = summaries.get(".") ?? {
      path: ".",
      name: "Root Import",
      depth: 0,
      countsKnown: true,
      printFileCount: 0,
      imageFileCount: 0,
      metadataFileCount: 0,
      totalSizeBytes: 0,
      lastModified: 0,
    };
    rootSummary.countsKnown = true;
    summaries.set(".", rootSummary);
    await options.onProgress?.({ ...progress });
  }
}

function getScanRoots(root: string, rootPaths?: string[]) {
  const normalizedPaths = Array.from(
    new Set((rootPaths ?? []).map(normalizeRelativePath).filter(Boolean)),
  );

  if (!normalizedPaths.length) {
    return [root];
  }

  return normalizedPaths.map((entry) => resolveImportScanRoot(root, entry));
}

export async function scanImportRoot(options: ScanImportRootOptions = {}) {
  const root = getImportRoot();
  await fs.mkdir(root, { recursive: true });
  const files: ServerImportFile[] = [];
  const progress: ServerImportScanProgress = {
    currentPath: ".",
    entriesVisited: 0,
    directoriesVisited: 0,
    filesMatched: 0,
  };
  for (const scanRoot of getScanRoots(root, options.rootPaths)) {
    await walkImportRoot(root, scanRoot, files, progress, options);
    if (files.length >= MAX_SCAN_FILES) {
      break;
    }
  }

  return {
    root,
    files: files.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath, "de-DE"),
    ),
    truncated: files.length >= MAX_SCAN_FILES,
  };
}

export async function scanImportFolderSummaries(options: ScanImportRootOptions = {}) {
  const root = getImportRoot();
  await fs.mkdir(root, { recursive: true });
  const summaries = new Map<string, ServerImportFolderSummary>();
  const progress: ServerImportScanProgress = {
    currentPath: ".",
    entriesVisited: 0,
    directoriesVisited: 0,
    filesMatched: 0,
  };

  for (const scanRoot of getScanRoots(root, options.rootPaths)) {
    await readShallowImportFolderSummaries(root, scanRoot, summaries, progress, options);
  }

  return {
    root,
    folders: Array.from(summaries.values())
      .sort((left, right) => left.path.localeCompare(right.path, "de-DE")),
  };
}
