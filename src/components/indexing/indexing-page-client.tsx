"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { deleteStoredFilesByPrefix, getStoredFile, putStoredFile } from "@/src/lib/file-store";
import { extractPdfMetadata, isPdfMetadataFile } from "@/src/lib/pdf-metadata";
import {
  detectSourcePlatform,
  humanFileSize,
  isSupportedIndexingFile,
  isSupportedLaserFile,
  isSupportedPlotterFile,
  isSupportedProjectFile,
  makeId,
} from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

const INDEXING_SESSION_STORAGE_KEY = "makershelf-indexing-session-v1";
const INDEXING_BLOB_PREFIX = "makershelf-indexing:";

type PersistedSessionFile = File & {
  webkitRelativePath?: string;
  __makershelfIndexingKey?: string;
};

type ServerIndexingFile = {
  kind: "server";
  sourcePath: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  lastModified: number;
  webkitRelativePath: string;
};

type IndexingFile = File | ServerIndexingFile;

type DeviceType = "3dp" | "laser" | "plotter";

type SourceFolder = {
  id: string;
  title: string;
  folderPath: string;
  projectRootPath: string;
  projectName: string;
  projectNameTouched: boolean;
  categoryId: string;
  creatorId: string;
  creatorFolderId: string;
  files: IndexingFile[];
  imageFiles: IndexingFile[];
  selected: boolean;
  sourceUrl?: string;
  sourcePlatform?: string;
  deviceType: DeviceType;
};

type ProjectGroup = {
  id: string;
  projectRootPath: string;
  projectName: string;
  categoryId: string;
  creatorId: string;
  creatorFolderId: string;
  selected: boolean;
  sourceFolders: SourceFolder[];
  files: IndexingFile[];
  imageFiles: IndexingFile[];
  sourceUrl?: string;
  sourcePlatform?: string;
  commonAncestorOptions: string[];
  deviceType: DeviceType;
};

type RelativePathFile = File & {
  webkitRelativePath?: string;
};

type ProjectTreeNode = {
  id: string;
  name: string;
  type: "folder" | "file";
  children: ProjectTreeNode[];
};

type PersistedFileRef = {
  key: string;
  name: string;
  type: string;
  lastModified: number;
  relativePath: string;
};

type PersistedSourceFolder = Omit<SourceFolder, "files" | "imageFiles"> & {
  files: PersistedFileRef[];
  imageFiles: PersistedFileRef[];
};

type ImportedProjectRecord = {
  id: string;
  projectName: string;
  projectRootPath: string;
  fileCount: number;
  sourceFolderCount: number;
  importedAt: string;
  kind: "imported" | "duplicate";
  projectId?: string;
  projectTitle?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
};

type ServerImportScanResponse = {
  error?: string;
  importRoot?: string;
  truncated?: boolean;
  folders?: ServerImportFolderSummary[];
  files?: Array<{
    sourcePath: string;
    name: string;
    relativePath: string;
    sizeBytes: number;
    mimeType: string;
    type: string;
    lastModified: number;
    kind: "print" | "image" | "metadata";
  }>;
};

type ServerImportFolderSummary = {
  path: string;
  name: string;
  depth?: number;
  countsKnown: boolean;
  printFileCount: number;
  imageFileCount: number;
  metadataFileCount: number;
  totalSizeBytes: number;
  lastModified: number;
};

type ServerImportScanStreamEvent =
  | {
      type: "progress";
      currentPath: string;
      entriesVisited: number;
      directoriesVisited: number;
      filesMatched: number;
    }
  | (ServerImportScanResponse & { type: "complete" })
  | {
      type: "error";
      error: string;
    };

function compactImportSelection(paths: string[]) {
  const normalized = Array.from(
    new Set(paths.map((entry) => entry.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")).filter(Boolean)),
  ).sort((left, right) => left.split("/").length - right.split("/").length);

  return normalized.filter(
    (path, index) =>
      !normalized
        .slice(0, index)
        .some((candidate) => path !== candidate && path.startsWith(`${candidate}/`)),
  );
}

type PersistedIndexingSession = {
  version: 1;
  sessionId: string;
  sourceFolders: PersistedSourceFolder[];
  importedGroups: ImportedProjectRecord[];
  status: string;
  projectSearch: string;
};

function getSessionPrefix(sessionId: string) {
  return `${INDEXING_BLOB_PREFIX}${sessionId}:`;
}

function getPersistedFileKey(file: File) {
  return (file as PersistedSessionFile).__makershelfIndexingKey || "";
}

function assignPersistedFileKey(file: File, key: string, relativePath?: string) {
  const sessionFile = file as PersistedSessionFile;
  Object.defineProperty(sessionFile, "__makershelfIndexingKey", {
    value: key,
    configurable: true,
  });
  Object.defineProperty(sessionFile, "webkitRelativePath", {
    value: relativePath || normalizeRelativePath(file),
    configurable: true,
  });
  return sessionFile;
}

function serializeFile(file: File): PersistedFileRef {
  return {
    key: getPersistedFileKey(file),
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    relativePath: normalizeRelativePath(file),
  };
}

function isServerIndexingFile(file: IndexingFile): file is ServerIndexingFile {
  return "kind" in file && file.kind === "server";
}

function isBrowserIndexingFile(file: IndexingFile): file is File {
  return !isServerIndexingFile(file);
}

function serializeSourceFolders(sourceFolders: SourceFolder[]): PersistedSourceFolder[] {
  return sourceFolders.map((folder) => ({
    ...folder,
    files: folder.files.filter(isBrowserIndexingFile).map(serializeFile),
    imageFiles: folder.imageFiles.filter(isBrowserIndexingFile).map(serializeFile),
  }));
}

async function restorePersistedFile(fileRef: PersistedFileRef) {
  const blob = await getStoredFile(fileRef.key);
  if (!blob) {
    return undefined;
  }

  const restored = new File([blob], fileRef.name, {
    type: fileRef.type,
    lastModified: fileRef.lastModified,
  });
  return assignPersistedFileKey(restored, fileRef.key, fileRef.relativePath);
}

async function restorePersistedSourceFolders(sourceFolders: PersistedSourceFolder[]) {
  const restoredFolders = await Promise.all(
    sourceFolders.map(async (folder) => {
      const files = (
        await Promise.all(folder.files.map((fileRef) => restorePersistedFile(fileRef)))
      ).filter(Boolean) as File[];
      const imageFiles = (
        await Promise.all(folder.imageFiles.map((fileRef) => restorePersistedFile(fileRef)))
      ).filter(Boolean) as File[];

      if (!files.length) {
        return null;
      }

      return {
        ...folder,
        files,
        imageFiles,
        deviceType: ((folder as unknown) as { deviceType?: DeviceType }).deviceType ?? "3dp",
      } satisfies SourceFolder;
    }),
  );

  return restoredFolders.filter(Boolean) as SourceFolder[];
}

function loadIndexingSession() {
  try {
    const raw = window.localStorage.getItem(INDEXING_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedIndexingSession;
    if (!parsed || parsed.version !== 1 || !parsed.sessionId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveIndexingSession(session: PersistedIndexingSession) {
  try {
    window.localStorage.setItem(INDEXING_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore local persistence failures and keep the page usable.
  }
}

async function tryPersistIndexingFile(
  file: File,
  key: string,
  relativePath: string,
) {
  try {
    await putStoredFile(key, file);
    return {
      file: assignPersistedFileKey(file, key, relativePath),
      persisted: true,
    };
  } catch {
    return {
      file: assignPersistedFileKey(file, "", relativePath),
      persisted: false,
    };
  }
}

async function clearIndexingSession(sessionId?: string) {
  try {
    window.localStorage.removeItem(INDEXING_SESSION_STORAGE_KEY);
  } catch {
    // Ignore local persistence failures and keep the page usable.
  }

  if (sessionId) {
    await deleteStoredFilesByPrefix(getSessionPrefix(sessionId));
  }
}

function normalizeRelativePath(file: IndexingFile) {
  return ((file as RelativePathFile).webkitRelativePath || file.name).replace(
    /\\/g,
    "/",
  );
}

function normalizeFolderPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function getFolderPath(file: IndexingFile) {
  const parts = normalizeRelativePath(file).split("/");
  return parts.slice(0, -1).join("/") || "Root Import";
}

function getFolderName(folderPath: string) {
  const parts = folderPath.split("/").filter(Boolean);
  return parts.at(-1) || "Root Import";
}

function getAncestorPaths(folderPath: string) {
  const parts = folderPath.split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

function getCommonAncestorOptions(sourceFolders: SourceFolder[]) {
  if (!sourceFolders.length) {
    return [];
  }

  const firstAncestors = getAncestorPaths(sourceFolders[0].folderPath);
  return firstAncestors.filter((path) =>
    sourceFolders.every(
      (folder) => folder.folderPath === path || folder.folderPath.startsWith(`${path}/`),
    ),
  );
}

function groupFilesByFolder<TFile extends IndexingFile>(files: TFile[]) {
  const groups = new Map<string, TFile[]>();

  files.forEach((file) => {
    const folderPath = getFolderPath(file);
    const current = groups.get(folderPath) ?? [];
    current.push(file);
    groups.set(folderPath, current);
  });

  return Array.from(groups.entries());
}

function updateScanProgressState(
  processedItems: number,
  totalItems: number,
  setScanProgress: (value: number) => void,
) {
  if (totalItems <= 0) {
    setScanProgress(100);
    return;
  }

  const normalized = Math.max(5, Math.min(98, Math.round((processedItems / totalItems) * 100)));
  setScanProgress(normalized);
}

function isMetadataLinkCandidate(file: IndexingFile) {
  const lower = file.name.toLowerCase();
  return (
    (isBrowserIndexingFile(file) && isPdfMetadataFile(file)) ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".url") ||
    lower.endsWith(".webloc") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  );
}

function findMetadataFileForFolder<TFile extends IndexingFile>(
  folderPath: string,
  metadataFiles: TFile[],
) {
  const normalizedFolder = normalizeFolderPath(folderPath);
  const candidates = metadataFiles
    .map((file) => ({
      file,
      folderPath: normalizeFolderPath(getFolderPath(file)),
    }))
    .filter(({ folderPath }) => {
      if (!folderPath) return metadataFiles.length === 1;
      return (
        folderPath === normalizedFolder ||
        normalizedFolder.startsWith(`${folderPath}/`) ||
        folderPath.startsWith(`${normalizedFolder}/`)
      );
    })
    .sort((left, right) => right.folderPath.length - left.folderPath.length);

  return candidates[0]?.file ?? (metadataFiles.length === 1 ? metadataFiles[0] : undefined);
}

function isImageCandidate(file: IndexingFile) {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

function normalizeCompareValue(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeStorageSegment(value: string, fallback: string) {
  const normalized = value
    .replace(/ä/gi, (match) => (match === match.toUpperCase() ? "Ae" : "ae"))
    .replace(/ö/gi, (match) => (match === match.toUpperCase() ? "Oe" : "oe"))
    .replace(/ü/gi, (match) => (match === match.toUpperCase() ? "Ue" : "ue"))
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function resolveCreatorStorageSegments(
  creators: Array<{ id: string; name: string; folders: Array<{ id: string; name: string }> }>,
  creatorId?: string,
  creatorFolderId?: string,
) {
  if (!creatorId) {
    return ["_Ohne-Creator"];
  }

  const creator = creators.find((entry) => entry.id === creatorId);
  const creatorSegment = sanitizeStorageSegment(creator?.name || "Unbekannter Creator", "Unbekannter-Creator");

  if (!creatorFolderId) {
    return ["Creators", creatorSegment, "_Ungeordnet"];
  }

  const folder = creator?.folders.find((entry) => entry.id === creatorFolderId);
  const folderSegment = sanitizeStorageSegment(folder?.name || "Ungeordnet", "_Ungeordnet");
  return ["Creators", creatorSegment, folderSegment];
}

function buildProjectedStoragePath(
  basePath: string,
  creators: Array<{ id: string; name: string; folders: Array<{ id: string; name: string }> }>,
  group: Pick<ProjectGroup, "projectName" | "creatorId" | "creatorFolderId">,
) {
  const trimmedBase = (basePath || "Projects").trim().replace(/[\\/]+$/, "") || "Projects";
  const creatorSegments = resolveCreatorStorageSegments(
    creators,
    group.creatorId || undefined,
    group.creatorFolderId || undefined,
  );
  const projectSegment = sanitizeStorageSegment(group.projectName, "Unbenanntes-Projekt");
  return [trimmedBase, ...creatorSegments, projectSegment].join("/");
}

function rankImageCandidate(file: IndexingFile) {
  const lower = file.name.toLowerCase();
  if (/cover|preview|thumbnail|thumb|hero|image/.test(lower)) {
    return 0;
  }
  if (/render|photo|shot/.test(lower)) {
    return 1;
  }
  return 2;
}

function pickBestCoverImage<TFile extends IndexingFile>(files: TFile[]) {
  return [...files].sort((left, right) => {
    const rankDiff = rankImageCandidate(left) - rankImageCandidate(right);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return left.name.localeCompare(right.name, "de-DE");
  })[0];
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

async function materializeImportFile(file: File, relativePath?: string) {
  try {
    const buffer = await file.arrayBuffer();
    const materialized = new File([buffer], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });

    const persistedKey = getPersistedFileKey(file);
    return assignPersistedFileKey(
      materialized,
      persistedKey,
      relativePath ?? normalizeRelativePath(file),
    );
  } catch (error) {
    const filePath = relativePath ?? normalizeRelativePath(file);
    const nextError = new Error(
      `Datei konnte nicht gelesen werden: ${filePath}. Bitte den Import-Ordner erneut auswählen.`,
    );
    if (error instanceof Error && error.stack) {
      nextError.stack = error.stack;
    }
    throw nextError;
  }
}

async function yieldToUi() {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function readServerImportScanStream(
  onProgress: (event: Extract<ServerImportScanStreamEvent, { type: "progress" }>) => void,
  options?: { mode?: "folders"; rootPaths?: string[] },
) {
  const params = new URLSearchParams({ stream: "1" });
  if (options?.mode) {
    params.set("mode", options.mode);
  }
  options?.rootPaths?.forEach((rootPath) => {
    params.append("rootPath", rootPath);
  });

  const response = await fetch(`/api/indexing/server-source?${params.toString()}`, { cache: "no-store" });
  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => ({}))) as ServerImportScanResponse;
    throw new Error(payload.error || "Import-Ordner konnte nicht gelesen werden.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const event = JSON.parse(line) as ServerImportScanStreamEvent;
      if (event.type === "progress") {
        onProgress(event);
      } else if (event.type === "complete") {
        return event;
      } else if (event.type === "error") {
        throw new Error(event.error);
      }
    }

    if (done) {
      break;
    }
  }

  throw new Error("Import-Ordner konnte nicht vollständig gelesen werden.");
}

async function readTextFile(file: File) {
  try {
    return await file.text();
  } catch {
    return "";
  }
}

async function extractUrlFromMetadataFile(file?: File) {
  if (!file) return "";

  if (isPdfMetadataFile(file)) {
    const metadata = await extractPdfMetadata(file);
    if (metadata?.sourceUrl) {
      return metadata.sourceUrl;
    }
  }

  const content = await readTextFile(file);
  const match = content.match(/https?:\/\/[^\s"'<>]+/i);
  return match?.[0]?.trim() ?? "";
}

function autoDetectDeviceType(files: IndexingFile[]): DeviceType {
  if (!files.length) return "3dp";
  const has3D = files.some((f) => isSupportedProjectFile(f.name));
  if (has3D) return "3dp";
  const hasPlotter = files.some((f) => isSupportedPlotterFile(f.name) && !isSupportedLaserFile(f.name));
  if (hasPlotter) return "plotter";
  const hasLaser = files.some((f) => isSupportedLaserFile(f.name));
  if (hasLaser) return "laser";
  return "3dp";
}

function buildProjectGroups(sourceFolders: SourceFolder[]) {
  const groups = new Map<string, ProjectGroup>();

  sourceFolders.forEach((folder) => {
    const current = groups.get(folder.projectRootPath);

    if (current) {
      current.sourceFolders.push(folder);
      current.files.push(...folder.files);
      current.imageFiles.push(...folder.imageFiles);
      current.selected = current.selected || folder.selected;
      if (!current.sourceUrl && folder.sourceUrl) {
        current.sourceUrl = folder.sourceUrl;
        current.sourcePlatform = folder.sourcePlatform;
      }
      return;
    }

    groups.set(folder.projectRootPath, {
      id: folder.projectRootPath,
      projectRootPath: folder.projectRootPath,
      projectName: folder.projectName,
      categoryId: folder.categoryId,
      creatorId: folder.creatorId,
      creatorFolderId: folder.creatorFolderId,
      selected: folder.selected,
      sourceFolders: [folder],
      files: [...folder.files],
      imageFiles: [...folder.imageFiles],
      sourceUrl: folder.sourceUrl,
      sourcePlatform: folder.sourcePlatform,
      commonAncestorOptions: [],
      deviceType: folder.deviceType,
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      sourceFolders: [...group.sourceFolders].sort((left, right) =>
        left.folderPath.localeCompare(right.folderPath, "de-DE"),
      ),
      commonAncestorOptions: getCommonAncestorOptions(group.sourceFolders),
    }))
    .sort((left, right) => left.projectName.localeCompare(right.projectName, "de-DE"));
}

function getMergedStatsForPath(sourceFolders: SourceFolder[], projectRootPath: string) {
  const matchingFolders = sourceFolders.filter(
    (folder) =>
      folder.folderPath === projectRootPath ||
      folder.folderPath.startsWith(`${projectRootPath}/`),
  );

  return {
    folderCount: matchingFolders.length,
    fileCount: matchingFolders.reduce((sum, folder) => sum + folder.files.length, 0),
  };
}

function getDescendantProjectOptions(group: ProjectGroup) {
  const options = new Set<string>();

  group.sourceFolders.forEach((folder) => {
    const ancestors = getAncestorPaths(folder.folderPath);
    ancestors.forEach((path) => {
      if (!group.projectRootPath) {
        if (path !== folder.folderPath) {
          options.add(path);
        }
        return;
      }

      if (
        path !== group.projectRootPath &&
        path.startsWith(`${group.projectRootPath}/`)
      ) {
        options.add(path);
      }
    });
  });

  return Array.from(options).sort((left, right) => left.localeCompare(right, "de-DE"));
}

function toProjectRelativePath(file: IndexingFile, projectRootPath: string) {
  const normalizedPath = normalizeRelativePath(file);
  const normalizedRoot = projectRootPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

  if (!normalizedRoot) {
    return normalizedPath;
  }

  if (normalizedPath === normalizedRoot) {
    return getFolderName(normalizedPath);
  }

  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }

  return normalizedPath;
}

function withProjectRelativePath(file: File, projectRootPath: string): File {
  const nextRelativePath = toProjectRelativePath(file, projectRootPath);
  const remappedFile = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  }) as RelativePathFile;

  Object.defineProperty(remappedFile, "webkitRelativePath", {
    value: nextRelativePath,
    configurable: true,
  });

  return remappedFile;
}

function buildProjectTree(files: IndexingFile[], projectRootPath: string) {
  const root: ProjectTreeNode = {
    id: projectRootPath || "root",
    name: getFolderName(projectRootPath) || "Projekt",
    type: "folder",
    children: [],
  };

  for (const file of files) {
    const relativePath = toProjectRelativePath(file, projectRootPath);
    const segments = relativePath.split("/").filter(Boolean);
    let current = root;
    let currentPath = projectRootPath;

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      let child = current.children.find(
        (entry) => entry.name === segment && entry.type === (isFile ? "file" : "folder"),
      );

      if (!child) {
        child = {
          id: `${currentPath}-${isFile ? "file" : "folder"}`,
          name: segment,
          type: isFile ? "file" : "folder",
          children: [],
        };
        current.children.push(child);
        current.children.sort((left, right) => {
          if (left.type !== right.type) {
            return left.type === "folder" ? -1 : 1;
          }

          return left.name.localeCompare(right.name, "de-DE");
        });
      }

      current = child;
    });
  }

  return root;
}

function renderProjectTree(nodes: ProjectTreeNode[], depth = 0): ReactNode {
  return nodes.map((node) => (
    <div key={node.id} style={{ marginBottom: "3px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "12.5px", marginLeft: `${depth * 14}px` }}>
        <span style={{ fontSize: "13px" }}>{node.type === "folder" ? "📁" : "🧩"}</span>
        <span style={{ fontWeight: node.type === "folder" ? 600 : 400, color: node.type === "folder" ? "var(--text-main)" : "var(--text-muted)" }}>{node.name}</span>
      </div>
      {node.children.length ? renderProjectTree(node.children, depth + 1) : null}
    </div>
  ));
}

export function IndexingPageClient() {
  const {
    ready,
    categories,
    creators,
    projects,
    createProject,
    createProjectWithFiles,
    importWebsiteMetadataToProject,
    createCategory,
    createCreator,
    refreshServerSnapshot,
    pushDebugLog,
    settings,
  } = useMakershelf();
  const [sourceFolders, setSourceFolders] = useState<SourceFolder[]>([]);
  const [status, setStatus] = useState("");
  const [activeImportId, setActiveImportId] = useState("");
  const [currentImportGroupId, setCurrentImportGroupId] = useState("");
  const [activeProgress, setActiveProgress] = useState(0);
  const [activePath, setActivePath] = useState("");
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activeFileTotal, setActiveFileTotal] = useState(0);
  const [scanInProgress, setScanInProgress] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [serverImportFolders, setServerImportFolders] = useState<ServerImportFolderSummary[]>([]);
  const [selectedServerImportPaths, setSelectedServerImportPaths] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionPersistenceEnabled, setSessionPersistenceEnabled] = useState(true);
  const [importedGroups, setImportedGroups] = useState<ImportedProjectRecord[]>([]);
  const [newCategoryDrafts, setNewCategoryDrafts] = useState<Record<string, string>>({});
  const [newCreatorNameDrafts, setNewCreatorNameDrafts] = useState<Record<string, string>>({});
  const [newCreatorFolderDrafts, setNewCreatorFolderDrafts] = useState<Record<string, string>>({});
  const runtimeConfig = getRuntimeConfig();
  const isServerImportMode = true;
  const isIndexingModePending = !ready && !isServerImportMode;
  const configuredImportRoot = runtimeConfig.importRoot || "/import";
  const configuredStorageRoot = runtimeConfig.storageRoot || "/storage";

  const creatorFolderOptions = useMemo(() => {
    return Object.fromEntries(
      creators.map((creator) => [creator.id, creator.folders]),
    ) as Record<string, typeof creators[number]["folders"]>;
  }, [creators]);

  const projectGroups = useMemo(() => buildProjectGroups(sourceFolders), [sourceFolders]);
  const filteredProjectGroups = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) {
      return projectGroups;
    }

    return projectGroups.filter((group) => {
      const haystack = [
        group.projectName,
        group.projectRootPath,
        ...group.sourceFolders.map((folder) => folder.folderPath),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [projectGroups, projectSearch]);
  const selectedGroups = useMemo(
    () => projectGroups.filter((group) => group.selected),
    [projectGroups],
  );
  const selectedServerImportRootPaths = useMemo(
    () => compactImportSelection(selectedServerImportPaths),
    [selectedServerImportPaths],
  );

  useEffect(() => {
    void (async () => {
      const persisted = loadIndexingSession();
      if (!persisted) {
        setSessionReady(true);
        return;
      }

      const restoredFolders = await restorePersistedSourceFolders(persisted.sourceFolders);
      setSessionId(persisted.sessionId);
      setSessionPersistenceEnabled(true);
      setSourceFolders(restoredFolders);
      setImportedGroups(persisted.importedGroups ?? []);
      setStatus(persisted.status ?? "");
      setProjectSearch(persisted.projectSearch ?? "");
      setSessionReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!sessionId && sourceFolders.length === 0 && importedGroups.length === 0) {
      void clearIndexingSession();
      return;
    }

    if (!sessionId || !sessionPersistenceEnabled) {
      return;
    }

    saveIndexingSession({
      version: 1,
      sessionId,
      sourceFolders: serializeSourceFolders(sourceFolders),
      importedGroups,
      status,
      projectSearch,
    });
  }, [sessionId, sessionReady, sessionPersistenceEnabled, sourceFolders, importedGroups, status, projectSearch]);

  function updateGroup(groupId: string, updater: (group: ProjectGroup) => Partial<ProjectGroup>) {
    setSourceFolders((current) =>
      current.map((folder) => {
        if (folder.projectRootPath !== groupId) {
          return folder;
        }

        const nextGroupState = updater(
          buildProjectGroups(current.filter((entry) => entry.projectRootPath === groupId))[0],
        );

        return {
          ...folder,
          categoryId: nextGroupState.categoryId ?? folder.categoryId,
          creatorId: nextGroupState.creatorId ?? folder.creatorId,
          creatorFolderId: nextGroupState.creatorFolderId ?? folder.creatorFolderId,
          selected: nextGroupState.selected ?? folder.selected,
          projectName:
            nextGroupState.projectName !== undefined ? nextGroupState.projectName : folder.projectName,
          projectNameTouched:
            nextGroupState.projectName !== undefined ? true : folder.projectNameTouched,
          deviceType: nextGroupState.deviceType ?? folder.deviceType,
        };
      }),
    );
  }

  function applyProjectRoot(projectRootPath: string) {
    const projectName = getFolderName(projectRootPath);

    setSourceFolders((current) =>
      current.map((folder) => {
        if (
          folder.folderPath === projectRootPath ||
          folder.folderPath.startsWith(`${projectRootPath}/`)
        ) {
          return {
            ...folder,
            projectRootPath,
            projectName: folder.projectNameTouched ? folder.projectName : projectName,
          };
        }
        return folder;
      }),
    );
  }

  function splitSourceFolder(folderId: string) {
    setSourceFolders((current) =>
      current.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              projectRootPath: folder.folderPath,
              projectName: getFolderName(folder.folderPath),
              projectNameTouched: false,
            }
          : folder,
      ),
    );
  }

  function applyGlobalProjectLevel(levelOffset: number) {
    setSourceFolders((current) =>
      current.map((folder) => {
        const ancestors = getAncestorPaths(folder.folderPath);
        const targetIndex = Math.max(0, ancestors.length - 1 - levelOffset);
        const targetPath = ancestors[targetIndex];

        return {
          ...folder,
          projectRootPath: targetPath,
          projectName: folder.projectNameTouched ? folder.projectName : getFolderName(targetPath),
        };
      }),
    );

    setStatus(
      text(
        settings.language,
        levelOffset === 0
          ? "Alle Quellordner bleiben zunächst eigene Projekte."
          : `Alle Quellordner wurden auf ${levelOffset} Ebene(n) höher zusammengeführt. Feintuning ist unten pro Projekt möglich.`,
        levelOffset === 0
          ? "All source folders stay as separate projects for now."
          : `All source folders were merged ${levelOffset} level(s) higher. Fine-tune each project below.`,
      ),
    );
  }

  function getNormalizedImportedPaths(group: ProjectGroup) {
    return group.files
      .map((file) => toProjectRelativePath(file, group.projectRootPath))
      .map(normalizeCompareValue)
      .sort();
  }

  function findExactExistingProject(group: ProjectGroup) {
    const normalizedTitle = normalizeCompareValue(group.projectName);
    const importedPaths = getNormalizedImportedPaths(group);

    return projects.find((project) => {
      if (normalizeCompareValue(project.title) !== normalizedTitle) {
        return false;
      }

      const existingPaths = project.files
        .map((file) => file.originalPath || file.name)
        .map(normalizeCompareValue)
        .sort();

      return (
        existingPaths.length === importedPaths.length &&
        existingPaths.every((path, index) => path === importedPaths[index])
      );
    });
  }

  async function importServerProjectGroup(
    group: ProjectGroup,
    updateImportProgress: (completedFraction: number) => void,
  ) {
    const serverFiles = group.files.filter(isServerIndexingFile);
    if (!serverFiles.length) {
      throw new Error("Keine serverseitigen Importdateien gefunden.");
    }

    const projectId = await createProject({
      title: group.projectName.trim() || getFolderName(group.projectRootPath),
      description:
        group.sourceFolders.length === 1
          ? `Mass import from folder ${group.projectRootPath}`
          : `Mass import from grouped folders under ${group.projectRootPath}`,
      categoryId: group.categoryId,
      creatorId: group.creatorId || undefined,
      creatorFolderId: group.creatorFolderId || undefined,
      license: "Unknown",
      tags: Array.from(new Set(group.sourceFolders.map((folder) => folder.title))),
      sourceUrl: group.sourceUrl,
    });

    updateImportProgress(group.files.length * 0.25);
    await yieldToUi();

    const storageBasePath = buildProjectedStoragePath(
      settings.storagePath || "Projects",
      creators,
      group,
    );
    const manifest = serverFiles.map((file) => {
      const projectRelativePath = toProjectRelativePath(file, group.projectRootPath);
      return {
        sourcePath: file.sourcePath,
        name: file.name,
        originalName: file.name,
        type: file.type,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        storedPath: `${storageBasePath}/${projectRelativePath}`.replace(/\/+/g, "/"),
        originalPath: projectRelativePath,
        folderPath: getFolderPath({ ...file, webkitRelativePath: projectRelativePath }),
        notes: "Direkt aus dem Unraid Import-Ordner übernommen.",
        source: "indexing" as const,
      };
    });

    for (let index = 0; index < manifest.length; index += 1) {
      const entry = manifest[index];
      setActivePath(entry.sourcePath);
      setStatus(
        text(
          settings.language,
          `Importiere ${group.projectName}: kopiere ${index + 1}/${manifest.length} - ${entry.sourcePath}`,
          `Importing ${group.projectName}: copying ${index + 1}/${manifest.length} - ${entry.sourcePath}`,
        ),
      );
      await yieldToUi();

      const response = await fetch("/api/indexing/server-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          manifest: [entry],
          cleanupRootPaths: index === manifest.length - 1 ? [group.projectRootPath] : [],
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        files?: unknown[];
        cleanup?: { deleted?: string[]; cleanupErrors?: string[] };
      };
      if (!response.ok) {
        throw new Error(payload.error || "Server-Import konnte nicht abgeschlossen werden.");
      }
      if (payload.cleanup?.cleanupErrors?.length) {
        pushDebugLog(
          `Importquelle konnte nicht vollstaendig bereinigt werden: ${payload.cleanup.cleanupErrors.join("; ")}`,
          "info",
        );
      }

      updateImportProgress(group.files.length * (0.25 + ((index + 1) / manifest.length) * 0.7));
    }

    await refreshServerSnapshot();
    updateImportProgress(group.files.length);
    setActivePath("");
    return projectId;
  }

  async function importProjectGroup(
    group: ProjectGroup,
    progressSeed: number,
    progressTotal: number,
  ) {
      const safeTotal = Math.max(progressTotal, 1);
      const updateImportProgress = (completedFraction: number) => {
        const normalized = Math.max(
          1,
          Math.min(
            100,
            Math.round(((progressSeed + completedFraction) / safeTotal) * 100),
          ),
        );
        setActiveProgress(normalized);
      };

      const existingProject = findExactExistingProject(group);
      if (existingProject) {
        setActivePath("");
        setStatus(
          text(
            settings.language,
            `Überspringe ${group.projectName}: Projekt ist bereits vorhanden.`,
            `Skipping ${group.projectName}: project already exists.`,
          ),
        );
        await yieldToUi();
        updateImportProgress(group.files.length);
        return {
          kind: "duplicate" as const,
          projectTitle: existingProject.title,
        };
      }

      if (group.files.some(isServerIndexingFile)) {
        setStatus(
          text(
            settings.language,
            `Importiere ${group.projectName}: Server-Dateien werden in den Projektordner kopiert...`,
            `Importing ${group.projectName}: copying server files into project storage...`,
          ),
        );
        await yieldToUi();
        const projectId = await importServerProjectGroup(group, updateImportProgress);
        return {
          kind: "imported" as const,
          projectId,
          projectTitle: group.projectName,
        };
      }

      setStatus(
        text(
          settings.language,
          `Importiere ${group.projectName}: Dateien werden vorbereitet...`,
          `Importing ${group.projectName}: preparing files...`,
        ),
      );
      await yieldToUi();

      const metadataSourceUrl = group.sourceUrl;
      const coverImageFile = pickBestCoverImage(group.imageFiles.filter(isBrowserIndexingFile));
      const materializedCoverImage = coverImageFile
        ? await materializeImportFile(coverImageFile)
        : undefined;
      const coverImage = materializedCoverImage
        ? await readFileAsDataUrl(materializedCoverImage)
        : undefined;
      const remappedFiles: File[] = [];
      const browserFiles = group.files.filter(isBrowserIndexingFile);
      setActiveFileTotal(browserFiles.length);
      setActiveFileIndex(0);

      for (let index = 0; index < browserFiles.length; index += 1) {
        const file = browserFiles[index];
        const remapped = withProjectRelativePath(file, group.projectRootPath);
        const relativePath = normalizeRelativePath(remapped);
        setActivePath(relativePath);
        setActiveFileIndex(index + 1);
        updateImportProgress(((index) / Math.max(group.files.length, 1)) * group.files.length * 0.7);
        await yieldToUi();
        remappedFiles.push(
          await materializeImportFile(remapped, relativePath),
        );
        updateImportProgress(((index + 1) / Math.max(group.files.length, 1)) * group.files.length * 0.7);
      }

      setStatus(
        text(
          settings.language,
          `Importiere ${group.projectName}: Projekt wird angelegt...`,
          `Importing ${group.projectName}: creating project...`,
        ),
      );
      await yieldToUi();

      const { projectId } = await createProjectWithFiles(
        {
        title: group.projectName.trim() || getFolderName(group.projectRootPath),
        description:
          group.sourceFolders.length === 1
          ? `Mass import from folder ${group.projectRootPath}`
          : `Mass import from grouped folders under ${group.projectRootPath}`,
      categoryId: group.categoryId,
      creatorId: group.creatorId || undefined,
      creatorFolderId: group.creatorFolderId || undefined,
      license: "Unknown",
      tags: Array.from(new Set(group.sourceFolders.map((folder) => folder.title))),
      sourceUrl: metadataSourceUrl,
      coverImage,
        },
        remappedFiles,
        "indexing",
        {
          onFileStatus: (name, index, total) => {
            setActivePath(name);
            setActiveFileIndex(index + 1);
            setActiveFileTotal(total);
            setStatus(
              text(
                settings.language,
                `Importiere ${group.projectName}: kopiere ${index + 1}/${total} - ${name}`,
                `Importing ${group.projectName}: copying ${index + 1}/${total} - ${name}`,
              ),
            );
          },
        },
        (progress) => {
          updateImportProgress(group.files.length * (0.72 + progress * 0.26));
        },
      );
      updateImportProgress(group.files.length * 0.92);

      if (metadataSourceUrl) {
        setStatus(
          text(
            settings.language,
            `Importiere ${group.projectName}: Metadaten werden übernommen...`,
            `Importing ${group.projectName}: applying metadata...`,
          ),
        );
        await yieldToUi();
        try {
          const response = await fetch("/api/import-metadata", {
            method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: metadataSourceUrl }),
        });
        const metadata = (await response.json()) as {
          error?: string;
          title?: string;
          description?: string;
          author?: string;
          license?: string;
          tags?: string[];
          images?: string[];
          sourcePlatform?: string;
          fileLinks?: string[];
          warnings?: string[];
          sourceUrl: string;
        };

        if (response.ok) {
          await importWebsiteMetadataToProject(projectId, metadata);
        }
        } catch {
          // Metadata import is optional during folder indexing.
        }
      }
      updateImportProgress(group.files.length);

      return {
        kind: "imported" as const,
      projectId,
      projectTitle: group.projectName,
    };
  }

  function removeImportedSourceFolders(importedGroups: ProjectGroup[]) {
    const importedRoots = importedGroups.map((group) => group.projectRootPath);

    setSourceFolders((current) =>
      current.filter(
        (folder) =>
          !importedRoots.some(
            (rootPath) =>
              folder.projectRootPath === rootPath ||
              folder.folderPath === rootPath ||
              folder.folderPath.startsWith(`${rootPath}/`),
          ),
      ),
    );
  }

  function rememberImportedGroup(
    group: ProjectGroup,
    result: {
      kind: "imported" | "duplicate";
      projectId?: string;
      projectTitle?: string;
    },
  ) {
    setImportedGroups((current) => [
      {
        id: `${group.projectRootPath}-${result.kind}-${current.length}`,
        projectName: group.projectName,
        projectRootPath: group.projectRootPath,
        fileCount: group.files.length,
        sourceFolderCount: group.sourceFolders.length,
        importedAt: new Date().toISOString(),
        kind: result.kind,
        projectId: result.projectId,
        projectTitle: result.projectTitle,
        sourceUrl: group.sourceUrl,
        sourcePlatform: group.sourcePlatform,
      },
      ...current.filter(
        (entry) =>
          !(
            entry.projectRootPath === group.projectRootPath &&
            entry.projectName === group.projectName
          ),
      ),
    ]);
  }

  async function resetIndexingSession() {
    const currentSessionId = sessionId;
    setSourceFolders([]);
    setImportedGroups([]);
    setProjectSearch("");
    setStatus(
      text(
        settings.language,
        "Importvorschau verworfen. Du kannst jetzt einen neuen Ordner auswählen.",
        "Import preview discarded. You can choose a new folder now.",
      ),
    );
    setActiveImportId("");
    setCurrentImportGroupId("");
    setActiveProgress(0); setActiveFileIndex(0); setActiveFileTotal(0);
    setActivePath("");
    setScanInProgress(false);
    setScanProgress(0);
    setScanStatus("");
    setNewCategoryDrafts({});
    setNewCreatorNameDrafts({});
    setNewCreatorFolderDrafts({});
    setServerImportFolders([]);
    setSelectedServerImportPaths([]);
    setSessionId("");
    setSessionPersistenceEnabled(true);
    await clearIndexingSession(currentSessionId);
  }

  async function buildServerImportPreviewFromPayload(
    payload: ServerImportScanResponse,
    currentSessionId: string,
  ) {
    const serverFiles: ServerIndexingFile[] = (payload.files ?? []).map((file) => ({
      kind: "server",
      sourcePath: file.sourcePath,
      name: file.name,
      type: file.type,
      mimeType: file.mimeType,
      size: file.sizeBytes,
      lastModified: file.lastModified,
      webkitRelativePath: file.relativePath,
    }));
    const printFiles = serverFiles.filter((file) => isSupportedIndexingFile(file.name));
    const imageFiles = serverFiles.filter((file) => isImageCandidate(file));
    const grouped = groupFilesByFolder(printFiles);
    const nextFolders: SourceFolder[] = [];

    if (!grouped.length) {
      setSourceFolders([]);
      setImportedGroups([]);
      setSessionId("");
      await clearIndexingSession(currentSessionId);
      setStatus(
        text(
          settings.language,
          `Keine unterstützten Druckdateien im gewählten Server-Importbereich gefunden.`,
          `No supported print files found in the selected server import scope.`,
        ),
      );
      return;
    }

    for (let index = 0; index < grouped.length; index += 1) {
      const [folderPath, groupedFiles] = grouped[index];
      const groupedImages = imageFiles.filter(
        (file) =>
          getFolderPath(file) === folderPath ||
          getFolderPath(file).startsWith(`${folderPath}/`),
      );
      const title = getFolderName(folderPath);
      nextFolders.push({
        id: folderPath,
        title,
        folderPath,
        projectRootPath: folderPath,
        projectName: title,
        projectNameTouched: false,
        categoryId: categories[0]?.id ?? "",
        creatorId: "",
        creatorFolderId: "",
        files: groupedFiles,
        imageFiles: groupedImages,
        selected: true,
        deviceType: autoDetectDeviceType(groupedFiles),
      });
      setActivePath(folderPath);
      setScanStatus(
        text(
          settings.language,
          `Baue Vorschau fuer ${folderPath} (${index + 1}/${grouped.length})`,
          `Building preview for ${folderPath} (${index + 1}/${grouped.length})`,
        ),
      );
      setScanProgress(85 + Math.round(((index + 1) / grouped.length) * 14));
      if ((index + 1) % 10 === 0) {
        await yieldToUi();
      }
    }

    if (currentSessionId) {
      await clearIndexingSession(currentSessionId);
    }
    setSessionPersistenceEnabled(false);
    setSessionId("");
    setServerImportFolders([]);
    setSelectedServerImportPaths([]);
    setSourceFolders(nextFolders);
    setImportedGroups([]);
    setStatus(
      text(
        settings.language,
        `${nextFolders.length} Projektkandidaten aus ${payload.importRoot || configuredImportRoot} vorbereitet. Ziel ist ${configuredStorageRoot}.`,
        `${nextFolders.length} project candidates prepared from ${payload.importRoot || configuredImportRoot}. Target is ${configuredStorageRoot}.`,
      ),
    );
    setScanProgress(100);
    setActivePath("");
  }

  async function handleServerImportFolderScan() {
    setScanInProgress(true);
    setScanProgress(1);
    setActivePath(configuredImportRoot);
    setScanStatus(
      text(
        settings.language,
        `Import-Ordner ${configuredImportRoot} wird serverseitig gescannt...`,
        `Scanning server import folder ${configuredImportRoot}...`,
      ),
    );

    try {
      const payload = await readServerImportScanStream((event) => {
        const pseudoProgress = Math.min(
          85,
          3 + Math.floor(Math.sqrt(Math.max(event.entriesVisited, 1)) * 2),
        );
        setScanProgress(pseudoProgress);
        setActivePath(event.currentPath);
        setScanStatus(
          text(
            settings.language,
            `Scanne ${event.currentPath} - ${event.filesMatched} passende Dateien gefunden`,
            `Scanning ${event.currentPath} - ${event.filesMatched} matching files found`,
          ),
        );
      }, { mode: "folders" });

      const folders = payload.folders ?? [];
      const defaultSelection = folders
        .filter((folder) => (folder.depth ?? folder.path.split("/").filter(Boolean).length) <= 1)
        .map((folder) => folder.path);
      setSourceFolders([]);
      setImportedGroups([]);
      setServerImportFolders(folders);
      setSelectedServerImportPaths(defaultSelection.length ? defaultSelection : folders.map((folder) => folder.path));
      setStatus(
        text(
          settings.language,
          folders.length
            ? `${folders.length} Überordner aus ${payload.importRoot || configuredImportRoot} erkannt. Wähle nun gezielt aus, welche davon als nächstes vorbereitet werden sollen.`
            : `Keine unterstützten Druckdateien im Server-Importordner ${payload.importRoot || configuredImportRoot} gefunden.`,
          folders.length
            ? `${folders.length} parent folders detected from ${payload.importRoot || configuredImportRoot}. Choose which ones should be prepared next.`
            : `No supported print files found in server import folder ${payload.importRoot || configuredImportRoot}.`,
        ),
      );
      setScanProgress(100);
      setActivePath("");
    } catch (error) {
      setStatus(
        text(
          settings.language,
          `Server-Import fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
          `Server import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    } finally {
      setScanInProgress(false);
      setScanStatus("");
      setActivePath("");
    }
  }

  async function handlePrepareSelectedServerFolders() {
    if (!selectedServerImportPaths.length) {
      setStatus(
        text(
          settings.language,
          "Bitte mindestens einen Überordner auswählen.",
          "Please select at least one parent folder.",
        ),
      );
      return;
    }

    const compactSelection = selectedServerImportRootPaths;
    const currentSessionId = sessionId;
    setScanInProgress(true);
    setScanProgress(1);
    setActivePath(compactSelection.join(", "));
    setScanStatus(
      text(
        settings.language,
        `${compactSelection.length} Importbereiche werden vorbereitet...`,
        `${compactSelection.length} import areas are being prepared...`,
      ),
    );

    try {
      const payload = await readServerImportScanStream((event) => {
        const pseudoProgress = Math.min(
          85,
          3 + Math.floor(Math.sqrt(Math.max(event.entriesVisited, 1)) * 2),
        );
        setScanProgress(pseudoProgress);
        setActivePath(event.currentPath);
        setScanStatus(
          text(
            settings.language,
            `Scanne ${event.currentPath} - ${event.filesMatched} passende Dateien gefunden`,
            `Scanning ${event.currentPath} - ${event.filesMatched} matching files found`,
          ),
        );
      }, { rootPaths: compactSelection });

      await buildServerImportPreviewFromPayload(payload, currentSessionId);
    } catch (error) {
      setStatus(
        text(
          settings.language,
          `Server-Import fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
          `Server import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    } finally {
      setScanInProgress(false);
      setScanStatus("");
      setActivePath("");
    }
  }

  async function handleImportSelected() {
    if (!selectedGroups.length) {
      setStatus(
        text(
          settings.language,
          "Bitte mindestens ein Projekt auswählen.",
          "Please select at least one project.",
        ),
      );
      return;
    }

    const totalFiles = selectedGroups.reduce((sum, group) => sum + group.files.length, 0);
    let completedFiles = 0;
    let importedCount = 0;
    let duplicateCount = 0;
      const removableGroups: ProjectGroup[] = [];

      setActiveImportId("batch");
      setCurrentImportGroupId("");
      setActiveProgress(0); setActiveFileIndex(0); setActiveFileTotal(0);
      setActivePath("");
      setStatus(
        text(
          settings.language,
          `Starte Batch-Import für ${selectedGroups.length} Projektgruppen...`,
          `Starting batch import for ${selectedGroups.length} project groups...`,
        ),
      );

      for (let index = 0; index < selectedGroups.length; index += 1) {
        const group = selectedGroups[index];
        setCurrentImportGroupId(group.id);
        setStatus(
          text(
            settings.language,
            `Batch-Import ${index + 1}/${selectedGroups.length}: ${group.projectName} wird importiert...`,
            `Batch import ${index + 1}/${selectedGroups.length}: importing ${group.projectName}...`,
          ),
        );
        await yieldToUi();
        if (group.deviceType === "laser" || group.deviceType === "plotter") {
          const deviceType = group.deviceType;
          await importLaserPlotterGroup(group, deviceType, (pct) => {
            setActiveProgress(Math.round(((completedFiles + (pct / 100) * group.files.length) / totalFiles) * 100));
          });
          rememberImportedGroup(group, { kind: "imported" });
          importedCount += 1;
        } else {
          const result = await importProjectGroup(group, completedFiles, totalFiles);
          rememberImportedGroup(group, result);
          if (result.kind === "duplicate") {
            duplicateCount += 1;
          } else {
            importedCount += 1;
          }
        }
        completedFiles += group.files.length;
        removableGroups.push(group);
    }

    removeImportedSourceFolders(removableGroups);
    setActiveImportId("");
    setCurrentImportGroupId("");
    setActiveProgress(0); setActiveFileIndex(0); setActiveFileTotal(0);
    setActivePath("");
    setStatus(
      text(
        settings.language,
        duplicateCount
          ? `${importedCount} Projekte importiert, ${duplicateCount} bereits vorhandene Projekte erkannt und alle verwendeten Ordner aus der Vorschau entfernt`
          : `${importedCount} Projekte importiert und aus der Vorschau entfernt`,
        duplicateCount
          ? `${importedCount} projects imported, ${duplicateCount} already existing projects detected and all used folders removed from preview`
          : `${importedCount} projects imported and removed from preview`,
      ),
    );

    if (isServerImportMode && importedCount > 0) {
      window.setTimeout(() => window.location.reload(), 800);
    }
  }

  async function importLaserPlotterGroup(
    group: ProjectGroup,
    deviceType: "laser" | "plotter",
    updateImportProgress: (pct: number) => void,
  ) {
    const isValidFile = deviceType === "plotter" ? isSupportedPlotterFile : isSupportedLaserFile;
    const validFiles = group.files.filter((f) => isValidFile(f.name));
    const total = Math.max(validFiles.length, 1);

    // ── Server-side files ────────────────────────────────────────────────
    const serverFiles = validFiles.filter(isServerIndexingFile);
    if (serverFiles.length) {
      setStatus(text(settings.language,
        `Kopiere ${serverFiles.length} Dateien in die ${deviceType === "plotter" ? "Plotter" : "Laser"}-Bibliothek...`,
        `Copying ${serverFiles.length} files into ${deviceType === "plotter" ? "plotter" : "laser"} library...`,
      ));
      await yieldToUi();
      const response = await fetch("/api/laser/files/import-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceType,
          files: serverFiles.map((f) => ({ sourcePath: f.sourcePath, name: f.name, tags: [], notes: "" })),
        }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Server-Dateiimport fehlgeschlagen.");
      }
      updateImportProgress(serverFiles.length / total * 100);
    }

    // ── Browser files ─────────────────────────────────────────────────────
    const browserFiles = validFiles.filter(isBrowserIndexingFile);
    setActiveFileTotal(browserFiles.length);
    for (let i = 0; i < browserFiles.length; i++) {
      const file = browserFiles[i];
      setActivePath(file.name);
      setActiveFileIndex(i + 1);
      await yieldToUi();

      const fd = new FormData();
      fd.append("deviceType", deviceType);
      fd.append("file", await materializeImportFile(file));

      const response = await fetch("/api/laser/files", { method: "POST", body: fd });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Upload fehlgeschlagen: ${file.name}`);
      }
      updateImportProgress(((serverFiles.length + i + 1) / total) * 100);
    }

    setActivePath("");
  }

  async function handleImportSingleGroup(group: ProjectGroup) {
      setActiveImportId(group.id);
      setCurrentImportGroupId(group.id);
      setActiveProgress(0); setActiveFileIndex(0); setActiveFileTotal(0);
      setActivePath("");
      try {
        setStatus(
          text(
            settings.language,
            `Starte Import für ${group.projectName}...`,
            `Starting import for ${group.projectName}...`,
          ),
        );

        if (group.deviceType === "laser" || group.deviceType === "plotter") {
          const deviceType = group.deviceType;
          await importLaserPlotterGroup(group, deviceType, (pct) => setActiveProgress(Math.round(pct)));
          rememberImportedGroup(group, { kind: "imported" });
          removeImportedSourceFolders([group]);
          setStatus(text(
            settings.language,
            `${group.files.length} Dateien in die ${deviceType === "plotter" ? "Plotter" : "Laser"}-Bibliothek importiert.`,
            `${group.files.length} files imported into ${deviceType === "plotter" ? "plotter" : "laser"} library.`,
          ));
        } else {
          const result = await importProjectGroup(group, 0, group.files.length);
          rememberImportedGroup(group, result);
          removeImportedSourceFolders([group]);
          setStatus(
            text(
              settings.language,
              result.kind === "duplicate"
                ? `Projekt ${result.projectTitle} existiert bereits und wurde aus der Vorschau entfernt`
                : `Projekt ${group.projectName} importiert und aus der Vorschau entfernt`,
              result.kind === "duplicate"
                ? `Project ${result.projectTitle} already exists and was removed from preview`
                : `Project ${group.projectName} imported and removed from preview`,
            ),
          );
          if (isServerImportMode && result.kind === "imported") {
            window.setTimeout(() => window.location.reload(), 800);
          }
        }
    } catch (error) {
      setStatus(
        text(
          settings.language,
          error instanceof Error
            ? `Import fehlgeschlagen: ${error.message}`
            : "Import fehlgeschlagen. Bitte erneut versuchen.",
          error instanceof Error
            ? `Import failed: ${error.message}`
            : "Import failed. Please try again.",
        ),
      );
    } finally {
      setActiveImportId("");
      setCurrentImportGroupId("");
      setActiveProgress(0); setActiveFileIndex(0); setActiveFileTotal(0);
      setActivePath("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(settings.language, "Massenimport", "Bulk import")}</h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              "Ordner analysieren, Projektstruktur festlegen und importieren",
              "Analyze folders, define project structure and import",
            )}
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="panel panel-padded">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {isServerImportMode ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleServerImportFolderScan()}
              disabled={!ready || scanInProgress}
            >
              {!ready
                ? text(settings.language, "Wird vorbereitet...", "Preparing...")
                : scanInProgress
                ? text(settings.language, "Scannt...", "Scanning...")
                : text(settings.language, "Server-Import scannen", "Scan server import")}
            </button>
          ) : isIndexingModePending ? (
            <button type="button" className="btn btn-primary" disabled>
              {text(settings.language, "Wird vorbereitet...", "Preparing...")}
            </button>
          ) : (
            <label className="btn btn-primary" style={{ cursor: "pointer" }}>
              {text(settings.language, "Import-Ordner wählen", "Choose import folder")}
              <input
              type="file"
              multiple
              style={{ display: "none" }}
              {...({ webkitdirectory: "true", directory: "true" } as Record<string, string>)}
              onChange={(event) => {
                void (async () => {
                  const previousSessionId = sessionId;
                  let nextSessionId = "";
                  let canPersistSession = true;
                  setScanInProgress(true);
                  setScanProgress(5);
                  setScanStatus(
                    text(
                      settings.language,
                      "Ordnerinhalt wird eingelesen...",
                      "Reading folder contents...",
                    ),
                  );

                  try {
                    const files = Array.from(event.target.files ?? []);
                    const printFiles = files.filter((file) => isSupportedIndexingFile(file.name));
                    const imageFiles = files.filter((file) => isImageCandidate(file));
                    const metadataFiles = files.filter((file) => isMetadataLinkCandidate(file));
                    const grouped = groupFilesByFolder(printFiles);
                    const nextFolders: SourceFolder[] = [];
                    nextSessionId = makeId("indexing-session");
                    const totalItemsToPersist =
                      printFiles.length + imageFiles.length + metadataFiles.length || files.length;
                    let processedItems = 0;
                    let blobIndex = 0;

                    if (!grouped.length) {
                      setSourceFolders([]);
                      setImportedGroups([]);
                      setSessionId("");
                      await clearIndexingSession(previousSessionId);
                      setStatus(
                        text(
                          settings.language,
                          "Keine unterstützten Druckdateien im gewählten Ordner gefunden.",
                          "No supported print files found in the selected folder.",
                        ),
                      );
                      return;
                    }

                    if (previousSessionId) {
                      await clearIndexingSession(previousSessionId);
                    }

                    setSessionPersistenceEnabled(true);

                    for (let index = 0; index < grouped.length; index += 1) {
                      const [folderPath, groupedFiles] = grouped[index];
                      const metadataFile = findMetadataFileForFolder(folderPath, metadataFiles);
                      const groupedImages = imageFiles.filter(
                        (file) =>
                          getFolderPath(file) === folderPath ||
                          getFolderPath(file).startsWith(`${folderPath}/`),
                      );
                      const sourceUrl = await extractUrlFromMetadataFile(metadataFile);
                      const title = getFolderName(folderPath);
                      const persistedFiles: File[] = [];
                      for (const file of groupedFiles) {
                        const relativePath = normalizeRelativePath(file);
                        const key = `${getSessionPrefix(nextSessionId)}file:${blobIndex}`;
                        blobIndex += 1;
                        if (canPersistSession) {
                          const persistedResult = await tryPersistIndexingFile(file, key, relativePath);
                          persistedFiles.push(persistedResult.file);
                          if (!persistedResult.persisted) {
                            canPersistSession = false;
                            setSessionPersistenceEnabled(false);
                            await clearIndexingSession(nextSessionId);
                            nextSessionId = "";
                            setStatus(
                              text(
                                settings.language,
                                "Temporäre Browser-Speicherung ist hier eingeschränkt. Die Ordneranalyse läuft weiter, bleibt aber nur bis zum Neuladen dieser Seite erhalten.",
                                "Temporary browser persistence is limited here. Folder analysis will continue, but the session will only remain available until this page is reloaded.",
                              ),
                            );
                          }
                        } else {
                          persistedFiles.push(assignPersistedFileKey(file, "", relativePath));
                        }
                        processedItems += 1;
                        updateScanProgressState(
                          processedItems,
                          totalItemsToPersist,
                          setScanProgress,
                        );
                        setScanStatus(
                          text(
                            settings.language,
                            `${processedItems} Dateien vorbereitet...`,
                            `${processedItems} files prepared...`,
                          ),
                        );
                      }

                      const persistedImages: File[] = [];
                      for (const file of groupedImages) {
                        const relativePath = normalizeRelativePath(file);
                        const key = `${getSessionPrefix(nextSessionId)}image:${blobIndex}`;
                        blobIndex += 1;
                        if (canPersistSession) {
                          const persistedResult = await tryPersistIndexingFile(file, key, relativePath);
                          persistedImages.push(persistedResult.file);
                          if (!persistedResult.persisted) {
                            canPersistSession = false;
                            setSessionPersistenceEnabled(false);
                            await clearIndexingSession(nextSessionId);
                            nextSessionId = "";
                            setStatus(
                              text(
                                settings.language,
                                "Temporäre Browser-Speicherung ist hier eingeschränkt. Die Ordneranalyse läuft weiter, bleibt aber nur bis zum Neuladen dieser Seite erhalten.",
                                "Temporary browser persistence is limited here. Folder analysis will continue, but the session will only remain available until this page is reloaded.",
                              ),
                            );
                          }
                        } else {
                          persistedImages.push(assignPersistedFileKey(file, "", relativePath));
                        }
                        processedItems += 1;
                        updateScanProgressState(
                          processedItems,
                          totalItemsToPersist,
                          setScanProgress,
                        );
                      }

                      nextFolders.push({
                        id: `${folderPath}-${index}`,
                        title,
                        projectName: title,
                        projectRootPath: folderPath,
                        projectNameTouched: false,
                        folderPath,
                        files: persistedFiles,
                        imageFiles: persistedImages,
                        categoryId: categories[0]?.id ?? "",
                        creatorId: "",
                        creatorFolderId: "",
                        selected: true,
                        sourceUrl: sourceUrl || undefined,
                        sourcePlatform: sourceUrl ? detectSourcePlatform(sourceUrl) : "",
                        deviceType: autoDetectDeviceType(persistedFiles),
                      } satisfies SourceFolder);

                      setScanStatus(
                        text(
                          settings.language,
                          `${index + 1} von ${grouped.length} Quellordnern analysiert...`,
                          `${index + 1} of ${grouped.length} source folders analyzed...`,
                        ),
                      );
                    }

                    setSessionId(nextSessionId);
                    setSourceFolders(nextFolders);
                    setImportedGroups([]);
                    setScanProgress(100);
                    setScanStatus(
                      text(
                        settings.language,
                        "Ordneranalyse abgeschlossen.",
                        "Folder analysis completed.",
                      ),
                    );
                    setStatus(
                      text(
                        settings.language,
                          canPersistSession
                            ? `${nextFolders.length} Quellordner erkannt, ${buildProjectGroups(nextFolders).length} Projektgruppen vorbereitet`
                            : `${nextFolders.length} Quellordner erkannt. Diese Sitzung bleibt bis zum Neuladen dieser Seite aktiv.`,
                          canPersistSession
                            ? `${nextFolders.length} source folders detected, ${buildProjectGroups(nextFolders).length} project groups prepared`
                            : `${nextFolders.length} source folders detected. This session will remain available until this page is reloaded.`,
                      ),
                    );
                  } catch (error) {
                    setSessionId("");
                    setSessionPersistenceEnabled(true);
                    setSourceFolders([]);
                    setImportedGroups([]);
                    await clearIndexingSession(previousSessionId);
                    if (nextSessionId) {
                      await clearIndexingSession(nextSessionId);
                    }
                    setStatus(
                      text(
                        settings.language,
                        error instanceof Error
                          ? `Ordneranalyse fehlgeschlagen: ${error.message}`
                          : "Ordneranalyse fehlgeschlagen. Bitte erneut versuchen.",
                        error instanceof Error
                          ? `Folder analysis failed: ${error.message}`
                          : "Folder analysis failed. Please try again.",
                      ),
                    );
                    setScanStatus(
                      text(
                        settings.language,
                        "Ordneranalyse wurde abgebrochen.",
                        "Folder analysis was aborted.",
                      ),
                    );
                  } finally {
                    event.target.value = "";
                    window.setTimeout(() => {
                      setScanInProgress(false);
                      setScanProgress(0);
                      setScanStatus("");
                    }, 450);
                  }
                })();
              }}
              />
            </label>
          )}
          {serverImportFolders.length > 0 && (
            <button
              type="button"
              onClick={() => void handlePrepareSelectedServerFolders()}
              className="btn btn-secondary"
              disabled={scanInProgress || selectedServerImportPaths.length === 0}
            >
              {text(settings.language, `Ordner vorbereiten (${selectedServerImportRootPaths.length})`, `Prepare folders (${selectedServerImportRootPaths.length})`)}
            </button>
          )}
          {selectedGroups.length > 0 && (
            <button type="button" onClick={() => void handleImportSelected()} className="btn btn-secondary">
              {text(settings.language, `Ausgewählte importieren (${selectedGroups.length})`, `Import selected (${selectedGroups.length})`)}
            </button>
          )}
          {projectGroups.length > 0 && (
            <button type="button" onClick={() => setSourceFolders((current) => current.map((folder) => ({ ...folder, selected: true })))} className="btn btn-ghost">
              {text(settings.language, "Alle auswählen", "Select all")}
            </button>
          )}
          {(projectGroups.length > 0 || importedGroups.length > 0 || serverImportFolders.length > 0) && (
            <button type="button" onClick={() => void resetIndexingSession()} className="btn btn-ghost">
              {text(settings.language, "Zurücksetzen", "Reset")}
            </button>
          )}
        </div>

        {isServerImportMode && (
          <p style={{ marginTop: "10px", fontSize: "12.5px", color: "var(--text-muted)" }}>
            {text(settings.language, `Quelle: ${configuredImportRoot} · Ziel: ${configuredStorageRoot}`, `Source: ${configuredImportRoot} · Target: ${configuredStorageRoot}`)}
          </p>
        )}

        {/* Progress indicator */}
        {(scanInProgress || activeImportId) && (
          <div style={{ marginTop: "16px", padding: "14px 16px", background: "var(--panel-muted)", borderRadius: "10px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "2px" }}>
                  {scanInProgress
                    ? text(settings.language, "Ordneranalyse läuft...", "Analyzing folders...")
                    : activeImportId === "batch"
                      ? text(settings.language, "Batch-Import läuft...", "Batch import running...")
                      : text(settings.language, "Import läuft...", "Importing...")}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {scanInProgress ? (scanStatus || text(settings.language, "Struktur wird vorbereitet...", "Preparing structure...")) : (status || "")}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <span className="badge badge-primary">{scanInProgress ? scanProgress : activeProgress}%</span>
                {!scanInProgress && activeFileTotal > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {activeFileIndex}/{activeFileTotal} {text(settings.language, "Dateien", "files")}
                  </span>
                )}
              </div>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${scanInProgress ? scanProgress : Math.max(activeProgress, activeFileTotal > 0 ? Math.round((activeFileIndex / activeFileTotal) * 100) : 0)}%` }} />
            </div>
            {activePath && (
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)", flexShrink: 0 }}>
                  {text(settings.language, "Datei", "File")}
                </span>
                <p style={{ fontSize: "12px", color: "var(--text-main)", wordBreak: "break-all", fontFamily: "monospace", fontWeight: 500 }}>{activePath}</p>
              </div>
            )}
          </div>
        )}

        {status && !scanInProgress && !activeImportId && (
          <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--text-muted)" }}>{status}</p>
        )}
      </div>

      {serverImportFolders.length > 0 && (
        <div className="panel">
          <div className="panel-section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>{text(settings.language, "Server-Importbereiche", "Server import areas")}</h2>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                {text(settings.language, "Wähle gezielt bis zu zwei Ebenen unter dem Import-Ordner aus.", "Select specific areas up to two levels below the import folder.")}
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedServerImportPaths(serverImportFolders.map((folder) => folder.path))}>
                {text(settings.language, "Alle", "All")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedServerImportPaths([])}>
                {text(settings.language, "Keine", "None")}
              </button>
            </div>
          </div>
          <div className="panel-section" style={{ display: "grid", gap: "8px" }}>
            {serverImportFolders.map((folder) => {
              const selected = selectedServerImportPaths.includes(folder.path);
              const depth = Math.max(0, folder.depth ?? folder.path.split("/").filter(Boolean).length);
              return (
                <label key={folder.path} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", padding: "12px 14px", marginLeft: `${Math.min(depth, 2) * 18}px`, background: selected ? "var(--primary-soft)" : "var(--panel-muted)", border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`, borderRadius: "10px", cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input type="checkbox" checked={selected} onChange={(event) => setSelectedServerImportPaths((current) => event.target.checked ? Array.from(new Set([...current, folder.path])) : current.filter((path) => path !== folder.path))} />
                      {depth > 0 && <span style={{ fontSize: "11px", color: "var(--text-soft)", width: "42px" }}>Ebene {depth}</span>}
                      <span style={{ fontWeight: 600, fontSize: "13.5px" }}>{folder.name}</span>
                    </div>
                    <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px", wordBreak: "break-all" }}>{folder.path}</p>
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {folder.countsKnown ? (
                      <>
                        <span className="badge badge-neutral">{folder.printFileCount} {text(settings.language, "Dateien", "files")}</span>
                        {folder.imageFileCount > 0 && <span className="badge badge-info">{folder.imageFileCount} Bilder</span>}
                        <span className="badge badge-neutral">{humanFileSize(folder.totalSizeBytes)}</span>
                      </>
                    ) : (
                      <span className="badge badge-neutral">{text(settings.language, "Details folgen", "Details pending")}</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {projectGroups.length > 0 && (
        <div className="panel panel-padded">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "14px" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 2px" }}>{text(settings.language, "Projektstruktur-Assistent", "Project structure")}</h2>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>{text(settings.language, "Projektebene global festlegen oder einzeln anpassen", "Set project level globally or adjust individually")}</p>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" onClick={() => applyGlobalProjectLevel(0)} className="btn btn-ghost btn-sm">{text(settings.language, "Ordner selbst", "Folders themselves")}</button>
              <button type="button" onClick={() => applyGlobalProjectLevel(1)} className="btn btn-ghost btn-sm">{text(settings.language, "1 Ebene höher", "1 level up")}</button>
              <button type="button" onClick={() => applyGlobalProjectLevel(2)} className="btn btn-ghost btn-sm">{text(settings.language, "2 Ebenen höher", "2 levels up")}</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "end" }}>
            <input
              className="input"
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
              placeholder={text(settings.language, "Projektname oder Ordner suchen...", "Search project name or folder...")}
            />
            <div style={{ background: "var(--panel-muted)", borderRadius: "8px", padding: "8px 14px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-soft)" }}>{text(settings.language, "Ordner", "Folders")}</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2, marginTop: "2px" }}>{sourceFolders.length}</div>
            </div>
            <div style={{ background: "var(--panel-muted)", borderRadius: "8px", padding: "8px 14px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-soft)" }}>{text(settings.language, "Gruppen", "Groups")}</div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.2, marginTop: "2px" }}>
                {filteredProjectGroups.length}{filteredProjectGroups.length !== projectGroups.length ? <span style={{ fontSize: "12px", color: "var(--text-muted)" }}> /{projectGroups.length}</span> : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      {importedGroups.length > 0 && (
        <div className="panel">
          <div className="panel-section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>{text(settings.language, "Bereits verarbeitet", "Processed")}</h2>
            <span className="badge badge-neutral">{importedGroups.length}</span>
          </div>
          <div className="panel-section" style={{ display: "grid", gap: "8px" }}>
            {importedGroups.map((entry) => (
              <div key={entry.id} style={{ background: "var(--panel-muted)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13.5px", fontWeight: 600 }}>{entry.projectName}</p>
                    <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px", wordBreak: "break-all" }}>{entry.projectRootPath}</p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      {entry.kind === "duplicate"
                        ? text(settings.language, `Bereits vorhanden als ${entry.projectTitle || entry.projectName}.`, `Already exists as ${entry.projectTitle || entry.projectName}.`)
                        : text(settings.language, "Import erfolgreich.", "Import completed.")}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge badge-neutral">{entry.fileCount} {text(settings.language, "Dateien", "files")}</span>
                    <span className={entry.kind === "duplicate" ? "badge badge-warning" : "badge badge-success"}>
                      {entry.kind === "duplicate" ? text(settings.language, "Vorhanden", "Exists") : text(settings.language, "Importiert", "Imported")}
                    </span>
                    {entry.projectId && (
                      <Link href={`/project/${entry.projectId}`} className="btn btn-primary btn-sm">
                        {text(settings.language, "Zum Projekt", "Open project")}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {filteredProjectGroups.map((group) => {
          const is3dp = group.deviceType === "3dp";
          const projectTree = buildProjectTree(group.files, group.projectRootPath);
          const descendantOptions = getDescendantProjectOptions(group);
          const projectedStoragePath = buildProjectedStoragePath(
            settings.storagePath,
            creators,
            group,
          );
          const willForceFilesystem = false;
          const isImporting = activeImportId === group.id || currentImportGroupId === group.id;
          const validLaserFiles = group.files.filter((f) => isSupportedLaserFile(f.name));
          const validPlotterFiles = group.files.filter((f) => isSupportedPlotterFile(f.name));
          const importableFileCount = group.deviceType === "laser"
            ? validLaserFiles.length
            : group.deviceType === "plotter"
              ? validPlotterFiles.length
              : group.files.length;

          const DEVICE_OPTIONS: Array<{ value: DeviceType; de: string; en: string; color: string }> = [
            { value: "3dp", de: "🖨️ 3D-Druck", en: "🖨️ 3D Print", color: "var(--primary)" },
            ...(settings.laserEnabled ? [{ value: "laser" as DeviceType, de: "⚡ Laser", en: "⚡ Laser", color: "#f59e0b" }] : []),
            ...(settings.plotterEnabled ? [{ value: "plotter" as DeviceType, de: "✏️ Plotter", en: "✏️ Plotter", color: "#10b981" }] : []),
          ];

          return (
            <div key={group.id} className="panel">
              {/* Group header */}
              <div className="panel-section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--panel-muted)", borderRadius: "8px", padding: "5px 12px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                      <input type="checkbox" checked={group.selected} onChange={(event) => updateGroup(group.id, () => ({ selected: event.target.checked }))} />
                      {text(settings.language, "Batch", "Batch")}
                    </label>
                    <span className="badge badge-neutral">{group.files.length} {text(settings.language, "Dateien", "files")}</span>
                    <span className="badge badge-neutral">{group.sourceFolders.length} {text(settings.language, "Ordner", "folders")}</span>
                    {group.sourceUrl && <span className="badge badge-info">{group.sourcePlatform || "Link"}</span>}
                  </div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.2px" }}>{group.projectName}</h2>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", wordBreak: "break-all" }}>{group.projectRootPath}</p>

                  {/* Device type picker */}
                  {DEVICE_OPTIONS.length > 1 && (
                    <div style={{ marginTop: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {DEVICE_OPTIONS.map((opt) => {
                        const active = group.deviceType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateGroup(group.id, () => ({ deviceType: opt.value }))}
                            style={{
                              padding: "5px 14px",
                              borderRadius: "8px",
                              border: `1px solid ${active ? opt.color : "var(--border)"}`,
                              background: active ? `${opt.color}22` : "var(--panel-muted)",
                              color: active ? opt.color : "var(--text-muted)",
                              fontSize: "12.5px",
                              fontWeight: active ? 700 : 500,
                              cursor: "pointer",
                            }}
                          >
                            {text(settings.language, opt.de, opt.en)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Target path (3D only) */}
                  {is3dp && (
                    <div style={{ marginTop: "10px", background: "var(--panel-muted)", borderRadius: "8px", padding: "8px 12px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)", marginBottom: "3px" }}>{text(settings.language, "Zielpfad", "Target path")}</div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, wordBreak: "break-all" }}>{projectedStoragePath}</div>
                      {willForceFilesystem && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{text(settings.language, "Automatisch auf Dateisystem-Speicherung umgeschaltet.", "Automatically switched to filesystem storage.")}</div>}
                    </div>
                  )}

                  {/* Laser/Plotter target hint */}
                  {!is3dp && (
                    <div style={{ marginTop: "10px", background: "var(--panel-muted)", borderRadius: "8px", padding: "8px 12px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: group.deviceType === "plotter" ? "#10b981" : "#f59e0b", marginBottom: "3px" }}>
                        {group.deviceType === "plotter"
                          ? text(settings.language, "Ziel: Plotter-Bibliothek", "Target: Plotter library")
                          : text(settings.language, "Ziel: Laser-Bibliothek", "Target: Laser library")}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {importableFileCount > 0
                          ? text(settings.language, `${importableFileCount} kompatible Dateien werden hochgeladen`, `${importableFileCount} compatible files will be uploaded`)
                          : text(settings.language, "⚠️ Keine kompatiblen Dateien in diesem Ordner", "⚠️ No compatible files in this folder")}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void handleImportSingleGroup(group)}
                  className="btn btn-primary"
                  style={{ whiteSpace: "nowrap" }}
                  disabled={!is3dp && importableFileCount === 0}
                >
                  {is3dp
                    ? text(settings.language, "Importieren", "Import")
                    : group.deviceType === "plotter"
                      ? text(settings.language, "→ Plotter", "→ Plotter")
                      : text(settings.language, "→ Laser", "→ Laser")}
                </button>
              </div>

              {/* Progress bar for this group */}
              {isImporting && (
                <div className="panel-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>
                      {activeProgress}%
                    </span>
                    {activeFileTotal > 0 && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {activeFileIndex}/{activeFileTotal} {text(settings.language, "Dateien", "files")}
                      </span>
                    )}
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.max(activeProgress, activeFileTotal > 0 ? Math.round((activeFileIndex / activeFileTotal) * 100) : 0)}%` }} />
                  </div>
                  {activePath && (
                    <div style={{ marginTop: "6px", display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)", flexShrink: 0 }}>
                        {text(settings.language, "Datei", "File")}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-main)", fontFamily: "monospace", wordBreak: "break-all" }}>{activePath}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Project name + level selection (3D only) */}
              {is3dp && <div className="panel-section" style={{ display: "grid", gap: "12px" }}>
                <div>
                  <label className="label">{text(settings.language, "Projektname", "Project name")}</label>
                  <input className="input" value={group.projectName} onChange={(event) => updateGroup(group.id, () => ({ projectName: event.target.value }))} placeholder={getFolderName(group.projectRootPath)} />
                </div>

                <div>
                  <label className="label">{text(settings.language, "Projektwurzel", "Project root")}</label>
                  <div style={{ display: "grid", gap: "6px" }}>
                    {group.commonAncestorOptions.map((path, index) => {
                      const active = path === group.projectRootPath;
                      const mergedStats = getMergedStatsForPath(sourceFolders, path);
                      const levelDistance = group.commonAncestorOptions.length - index - 1;
                      return (
                        <button key={path} type="button" onClick={() => { if (active) { void handleImportSingleGroup(group); return; } applyProjectRoot(path); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", borderRadius: "8px", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`, background: active ? "var(--primary-soft)" : "var(--panel-muted)", textAlign: "left", cursor: "pointer" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: "13px", fontWeight: 600 }}>
                              {levelDistance === 0 ? text(settings.language, "Dieser Ordner", "This folder") : text(settings.language, `${levelDistance}× höher`, `${levelDistance}× higher`)}
                            </p>
                            <p style={{ fontSize: "11px", color: "var(--text-muted)", wordBreak: "break-all", marginTop: "2px" }}>{path}</p>
                          </div>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <span className="badge badge-neutral">{mergedStats.fileCount} {text(settings.language, "Dateien", "files")}</span>
                          </div>
                        </button>
                      );
                    })}
                    {descendantOptions.map((path) => {
                      const mergedStats = getMergedStatsForPath(sourceFolders, path);
                      const active = path === group.projectRootPath;
                      return (
                        <button key={path} type="button" onClick={() => { if (active) { void handleImportSingleGroup(group); return; } applyProjectRoot(path); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", borderRadius: "8px", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`, background: active ? "var(--primary-soft)" : "var(--panel-muted)", textAlign: "left", cursor: "pointer" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: "13px", fontWeight: 600 }}>{text(settings.language, "Unterordner als Projekt", "Subfolder as project")}</p>
                            <p style={{ fontSize: "11px", color: "var(--text-muted)", wordBreak: "break-all", marginTop: "2px" }}>{path}</p>
                          </div>
                          <span className="badge badge-neutral">{mergedStats.fileCount} {text(settings.language, "Dateien", "files")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category + Creator */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="label">{text(settings.language, "Kategorie", "Category")}</label>
                    <select className="input select" value={group.categoryId} onChange={(event) => updateGroup(group.id, () => ({ categoryId: event.target.value }))}>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.emoji} {category.name}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      <input className="input" style={{ flex: 1 }} value={newCategoryDrafts[group.id] ?? ""} onChange={(event) => setNewCategoryDrafts((current) => ({ ...current, [group.id]: event.target.value }))} placeholder={text(settings.language, "+ Neue Kategorie", "+ New category")} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { const name = (newCategoryDrafts[group.id] ?? "").trim(); if (!name) return; const categoryId = await createCategory({ name, description: "", emoji: "📁", color: settings.primaryColor }); updateGroup(group.id, () => ({ categoryId })); setNewCategoryDrafts((current) => ({ ...current, [group.id]: "" })); }}>+</button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Creator</label>
                    <select className="input select" value={group.creatorId} onChange={(event) => updateGroup(group.id, () => ({ creatorId: event.target.value, creatorFolderId: "" }))}>
                      <option value="">{text(settings.language, "Nicht zuweisen", "Do not assign")}</option>
                      {creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
                    </select>
                    <select className="input select" style={{ marginTop: "6px" }} value={group.creatorFolderId} onChange={(event) => updateGroup(group.id, () => ({ creatorFolderId: event.target.value }))} disabled={!group.creatorId}>
                      <option value="">{text(settings.language, "Kein Unterordner", "No subfolder")}</option>
                      {(creatorFolderOptions[group.creatorId] ?? []).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      <input className="input" style={{ flex: 1 }} value={newCreatorNameDrafts[group.id] ?? ""} onChange={(event) => setNewCreatorNameDrafts((current) => ({ ...current, [group.id]: event.target.value }))} placeholder={text(settings.language, "+ Neuer Creator", "+ New creator")} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { const name = (newCreatorNameDrafts[group.id] ?? "").trim(); if (!name) return; const creatorId = await createCreator({ name, folders: (newCreatorFolderDrafts[group.id] ?? "").split(",").map((f) => f.trim()).filter(Boolean) }); updateGroup(group.id, () => ({ creatorId, creatorFolderId: "" })); setNewCreatorNameDrafts((current) => ({ ...current, [group.id]: "" })); setNewCreatorFolderDrafts((current) => ({ ...current, [group.id]: "" })); }}>+</button>
                    </div>
                  </div>
                </div>
              </div>}

              {/* File tree (3D) / File list (laser/plotter) */}
              <div className="panel-section" style={{ display: "grid", gridTemplateColumns: is3dp ? "1fr 1fr" : "1fr", gap: "12px" }}>
                {is3dp && (
                  <div style={{ background: "var(--panel-muted)", borderRadius: "8px", padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700 }}>{text(settings.language, "Struktur", "Structure")}</span>
                      <span className="badge badge-neutral">{group.sourceFolders.length}</span>
                    </div>
                    <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                      {renderProjectTree(projectTree.children)}
                    </div>
                    {group.sourceFolders.length > 1 && (
                      <div style={{ marginTop: "8px", borderTop: "1px solid var(--border)", paddingTop: "8px", display: "grid", gap: "4px" }}>
                        {group.sourceFolders.map((folder) => (
                          <div key={folder.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "6px 10px", background: "var(--panel)", borderRadius: "6px", fontSize: "12px" }}>
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.title}</span>
                            <button type="button" onClick={() => splitSourceFolder(folder.id)} className="btn btn-ghost btn-sm" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{text(settings.language, "Trennen", "Split")}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ background: "var(--panel-muted)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: 700 }}>{text(settings.language, "Dateien", "Files")}</span>
                    <span className="badge badge-neutral">{group.files.length}</span>
                  </div>
                  <div style={{ maxHeight: "240px", overflowY: "auto", display: "grid", gap: "4px" }}>
                    {group.files.map((file) => {
                      const relativePath = normalizeRelativePath(file);
                      const isCompatible = is3dp
                        || (group.deviceType === "laser" && isSupportedLaserFile(file.name))
                        || (group.deviceType === "plotter" && isSupportedPlotterFile(file.name));
                      return (
                        <div key={`${group.id}-${relativePath}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "5px 10px", background: "var(--panel)", borderRadius: "6px", fontSize: "12px", opacity: isCompatible ? 1 : 0.45 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{file.name}</div>
                            {!is3dp && !isCompatible && (
                              <div style={{ fontSize: "10px", color: "var(--danger)", marginTop: "1px" }}>{text(settings.language, "Nicht kompatibel", "Not compatible")}</div>
                            )}
                            {is3dp && <div style={{ fontSize: "11px", color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{relativePath}</div>}
                          </div>
                          <button type="button" onClick={() => setSourceFolders((current) => current.map((folder) => folder.projectRootPath === group.projectRootPath ? { ...folder, files: folder.files.filter((entry) => entry !== file) } : folder).filter((folder) => folder.files.length > 0))} className="btn btn-ghost btn-sm" style={{ fontSize: "11px", color: "var(--danger)" }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
