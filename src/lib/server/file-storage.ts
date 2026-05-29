import { promises as fs } from "node:fs";
import path from "node:path";

import type { StorageMode } from "@/src/lib/makershelf-data";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

type FileStorageLocation = {
  storedPath: string;
  storageMode?: StorageMode;
  storagePath?: string;
  preferRuntimeRoot?: boolean;
};

const DEFAULT_STORAGE_ROOT = ".makershelf-storage";

function normalizeStoredPath(storedPath: string) {
  const normalized = storedPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) {
    throw new Error("Leerer Speicherpfad ist nicht erlaubt.");
  }
  if (normalized.split("/").some((segment) => segment === "..")) {
    throw new Error("Ungültiger Speicherpfad.");
  }
  return normalized;
}

function toRelativeProjectPath(storedPath: string) {
  const normalized = normalizeStoredPath(storedPath);
  return normalized.replace(/^Projects\//, "");
}

function resolveDefaultStorageRoot() {
  const runtimeConfig = getRuntimeConfig();
  return runtimeConfig.storageRoot?.trim()
    ? path.resolve(runtimeConfig.storageRoot)
    : path.resolve(process.cwd(), DEFAULT_STORAGE_ROOT);
}

export function resolveStorageBaseDirectory({
  storageMode,
  storagePath,
  preferRuntimeRoot,
}: Omit<FileStorageLocation, "storedPath">) {
  const runtimeRoot = resolveDefaultStorageRoot();

  if (preferRuntimeRoot) {
    return runtimeRoot;
  }

  const trimmedPath = storagePath?.trim();
  if (trimmedPath && path.isAbsolute(trimmedPath)) {
    return path.resolve(trimmedPath);
  }

  if (storageMode === "custom-path" && trimmedPath) {
    return path.resolve(runtimeRoot, trimmedPath);
  }

  return path.resolve(runtimeRoot, trimmedPath || "Projects");
}

export function resolveStoredFileAbsolutePath(location: FileStorageLocation) {
  const baseDirectory = resolveStorageBaseDirectory(location);
  const relativeProjectPath = toRelativeProjectPath(location.storedPath);
  const absolutePath = path.resolve(baseDirectory, relativeProjectPath);

  if (
    absolutePath !== baseDirectory &&
    !absolutePath.startsWith(`${baseDirectory}${path.sep}`)
  ) {
    throw new Error("Dateipfad liegt außerhalb des erlaubten Speicherbereichs.");
  }

  return absolutePath;
}

export async function writeStoredFile(
  location: FileStorageLocation,
  content: Buffer | Uint8Array,
) {
  const absolutePath = resolveStoredFileAbsolutePath(location);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
  return absolutePath;
}

export async function readStoredFile(location: FileStorageLocation) {
  const absolutePath = resolveStoredFileAbsolutePath(location);
  return fs.readFile(absolutePath);
}

export async function deleteStoredFileFromDisk(location: FileStorageLocation) {
  const absolutePath = resolveStoredFileAbsolutePath(location);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function moveStoredFileOnDisk(
  source: FileStorageLocation,
  target: FileStorageLocation,
) {
  const sourceAbsolutePath = resolveStoredFileAbsolutePath(source);
  const targetAbsolutePath = resolveStoredFileAbsolutePath(target);

  if (sourceAbsolutePath === targetAbsolutePath) {
    return targetAbsolutePath;
  }

  await fs.mkdir(path.dirname(targetAbsolutePath), { recursive: true });

  try {
    await fs.rename(sourceAbsolutePath, targetAbsolutePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "EXDEV") {
      await fs.copyFile(sourceAbsolutePath, targetAbsolutePath);
      await fs.unlink(sourceAbsolutePath);
    } else {
      throw error;
    }
  }

  return targetAbsolutePath;
}
