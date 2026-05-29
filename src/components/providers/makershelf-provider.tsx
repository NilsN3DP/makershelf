"use client";

import JSZip from "jszip";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  defaultCategories,
  defaultSettings,
  detectFileType,
  detectSourcePlatform,
  getBaseName,
  getFolderPath,
  humanFileSize,
  isSupportedArchiveFile,
  isSupportedPrintFile,
  isZipArchiveFile,
  makeId,
  recommendDesktopApp,
  slugify,
  transliterateGerman,
  type AppSettings,
  type Category,
  type Creator,
  type DesktopOpenTarget,
  type FileType,
  type PrintFile,
  type Project,
  type ProjectActivity,
  type ProjectList,
  type ProjectLockField,
  type SetupInput,
  type SlicerApp,
} from "@/src/lib/makershelf-data";
import { getProjectFileStorageRelativePath } from "@/src/lib/project-file-storage-core";
import { buildArchiveImportStatus } from "@/src/lib/archive-import-progress-core";
import { buildProjectStorageBasePath } from "@/src/lib/project-info";
import {
  deleteStoredFilesByPrefix,
} from "@/src/lib/file-store";
import { createServerMakershelfRepository } from "@/src/lib/repositories/server-makershelf-repository";
import type { MakershelfSnapshot } from "@/src/lib/repositories/makershelf-repository";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

type ProjectInput = {
  title: string;
  description: string;
  categoryId: string;
  license: string;
  tags: string[];
  author?: string;
  sourceUrl?: string;
  coverImage?: string;
  creatorId?: string;
  creatorFolderId?: string;
  lockedFields?: ProjectLockField[];
  activity?: ProjectActivity;
};

type CategoryInput = Omit<Category, "id">;

type CreatorInput = {
  name: string;
  folders: string[];
};

type WebsiteImportMetadata = {
  title?: string;
  description?: string;
  author?: string;
  category?: string;
  license?: string;
  tags?: string[];
  images?: string[];
  sourcePlatform?: string;
  fileLinks?: string[];
  sourceUrl: string;
};

type RemoteImportFile = {
  name: string;
  mimeType?: string;
  data: number[];
  sourceUrl?: string;
};

type PersistedState = MakershelfSnapshot;

type TransferBundleManifest = {
  version: 1;
  exportedAt: string;
  snapshot: MakershelfSnapshot;
  fileEntries: Record<string, string>;
};

type DuplicateGroup = {
  key: string;
  files: Array<{
    projectId: string;
    projectTitle: string;
    file: PrintFile;
  }>;
};

type StatsSummary = {
  totalProjects: number;
  totalFiles: number;
  totalCategories: number;
  totalCreators: number;
  favoriteProjects: number;
  customLists: number;
  duplicateGroups: number;
  zippedFiles: number;
  websiteImports: number;
  indexedImports: number;
  filesByType: Array<{ type: string; count: number }>;
  projectsByCategory: Array<{ category: string; count: number }>;
  largestFiles: Array<{ projectTitle: string; fileName: string; sizeLabel: string }>;
};

type DebugEntry = {
  id: string;
  level: "info" | "error";
  message: string;
  at: string;
};

export type BackgroundJobStatus = "queued" | "running" | "completed" | "failed";

export type BackgroundJob = {
  id: string;
  type: "filesystem-move";
  label: string;
  projectId?: string;
  projectTitle?: string;
  status: BackgroundJobStatus;
  progress: number;
  processed: number;
  total: number;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type ZipImportMode = "extract" | "archive";
type ProjectFileImportOptions = {
  preserveFolderStructure?: boolean;
  extractArchives?: boolean;
  onArchiveStatus?: (message: string) => void;
  onFileStatus?: (name: string, index: number, total: number) => void;
};

type PreparedProjectUploadFile = {
  file: File;
  source: PrintFile["source"];
  extractedFromArchive?: string;
};

type StoredUploadDescriptor = {
  entry: PrintFile;
  file: File;
};

type StoredFileMoveDescriptor = {
  fileId?: string;
  oldStoredPath: string;
  newStoredPath: string;
};

type Parsed3mfMetadata = {
  sourceUrl?: string;
  sourcePlatform?: string;
  title?: string;
  description?: string;
  thumbnailDataUrl?: string;
  note?: string;
};

type ProjectFileImportProgressCallback = (progress: number) => void;

type ExtractedArchivePayload = {
  error?: string;
  files?: Array<{
    name: string;
    mimeType?: string;
    data: number[];
  }>;
  skipped?: number;
};

const MAX_BROWSER_ARCHIVE_IMPORT_BYTES = 512 * 1024 * 1024;

function getDesktopTargetForSettings(
  settings: AppSettings,
  file: PrintFile,
  slicer: SlicerApp,
): DesktopOpenTarget {
  const configured = settings.fileAssociations[file.type];
  if (configured === "slicer") {
    return slicer;
  }

  if (configured === "browser" || !configured) {
    return recommendDesktopApp(file.type, slicer);
  }

  return configured;
}

function normalizePersistedSettings(
  settings?: Partial<AppSettings>,
  runtimeOverrides?: Partial<Pick<AppSettings, "appName" | "dataBackend" | "storageDriver">>,
): AppSettings {
  const persistedAppName = settings?.appName?.trim();

  return {
    ...defaultSettings,
    pageSize: runtimeConfig.pageSize,
    dashboardFeaturedCount: runtimeConfig.dashboardFeaturedCount,
    maxPreviewFileSizeMb: runtimeConfig.maxPreviewFileSizeMb,
    ...settings,
    appName: runtimeOverrides?.appName ?? persistedAppName ?? runtimeConfig.appName,
    dataBackend: runtimeOverrides?.dataBackend ?? settings?.dataBackend ?? defaultSettings.dataBackend,
    storageMode: settings?.storageMode ?? defaultSettings.storageMode,
    storageDriver: "filesystem",
    setupCompleted: true,
    showBuyMeACoffeeButton: true,
    buyMeACoffeeUrl:
      settings?.buyMeACoffeeUrl?.trim() || defaultSettings.buyMeACoffeeUrl,
    enableExperimentalWebsiteImport: true,
    slicerExePaths: {
      ...defaultSettings.slicerExePaths,
      ...settings?.slicerExePaths,
    },
    fileAssociations: {
      ...defaultSettings.fileAssociations,
      ...settings?.fileAssociations,
    },
  };
}

function normalizePersistedProjects(projects: Project[]) {
  return projects.map((project) =>
    syncProject({
      ...project,
      files: project.files.map((file) => ({
        ...file,
        previewUrl: undefined,
      })),
    }),
  );
}

type MakershelfContextValue = {
  ready: boolean;
  settings: AppSettings;
  categories: Category[];
  creators: Creator[];
  projects: Project[];
  lists: ProjectList[];
  duplicates: DuplicateGroup[];
  stats: StatsSummary;
  debugLogs: DebugEntry[];
  backgroundJobs: BackgroundJob[];
  dismissBackgroundJob: (jobId: string) => void;
  completeSetup: (input: SetupInput) => Promise<void>;
  updateSettings: (input: Partial<AppSettings>) => Promise<void>;
  createCategory: (input: CategoryInput) => Promise<string>;
  updateCategory: (categoryId: string, input: CategoryInput) => void;
  deleteCategory: (categoryId: string) => Promise<void>;
  createCreator: (input: CreatorInput) => Promise<string>;
  updateCreator: (creatorId: string, input: CreatorInput) => Promise<void>;
  deleteCreator: (creatorId: string) => Promise<void>;
  createProject: (input: ProjectInput) => Promise<string>;
  createProjectWithFiles: (
    input: ProjectInput,
    files: FileList | File[],
    source?: PrintFile["source"],
    optionsOrProgress?: ProjectFileImportOptions | ProjectFileImportProgressCallback,
    onProgress?: ProjectFileImportProgressCallback,
  ) => Promise<{ projectId: string; added: number; skipped: number }>;
  updateProject: (projectId: string, input: ProjectInput) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  updateProjectLocks: (projectId: string, fields: ProjectLockField[]) => Promise<void>;
  updateProjectActivity: (projectId: string, activity: ProjectActivity) => void;
  addFilesToProject: (
    projectId: string,
    files: FileList | File[],
    source?: PrintFile["source"],
    options?: ProjectFileImportOptions,
  ) => Promise<{ added: number; skipped: number }>;
  addRemoteFilesToProject: (
    projectId: string,
    files: RemoteImportFile[],
    source?: PrintFile["source"],
  ) => Promise<{ added: number; skipped: number }>;
  addZipToProject: (
    projectId: string,
    zipFile: File,
    mode: ZipImportMode,
    options?: ProjectFileImportOptions,
  ) => Promise<{ added: number; skipped: number }>;
  importWebsiteMetadataToProject: (
    projectId: string,
    metadata: WebsiteImportMetadata,
  ) => Promise<void>;
  createProjectFromWebsiteMetadata: (metadata: WebsiteImportMetadata) => Promise<string>;
  deleteFileFromProject: (projectId: string, fileId: string) => void;
  setProjectThumbnail: (projectId: string, fileId: string) => void;
  buildSlicerLaunch: (slicer: SlicerApp, file: PrintFile) => string;
  buildDesktopOpenCommand: (file: PrintFile, slicer?: SlicerApp) => { label: string; command: string };
  getDesktopOpenTarget: (file: PrintFile, slicer?: SlicerApp) => DesktopOpenTarget;
  openDesktopFile: (file: PrintFile, slicer?: SlicerApp) => Promise<{ ok: boolean; message: string }>;
  openDesktopFiles: (files: PrintFile[], slicer?: SlicerApp) => Promise<{ ok: boolean; message: string }>;
  getFileBlob: (fileId: string) => Promise<Blob | undefined>;
  getFileObjectUrl: (fileId: string) => Promise<string>;
  downloadProjectFile: (file: PrintFile) => Promise<{ ok: boolean; message: string }>;
  setProjectFavorite: (projectId: string, favorite: boolean) => void;
  createList: (name: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  addProjectToList: (listId: string, projectId: string) => Promise<void>;
  removeProjectFromList: (listId: string, projectId: string) => Promise<void>;
  resolveDuplicateGroup: (groupKey: string, keepFileIds: string[]) => void;
  pushDebugLog: (message: string, level?: DebugEntry["level"]) => void;
  exportTransferBundle: () => Promise<void>;
  importTransferBundle: (file: File) => Promise<void>;
  refreshServerSnapshot: () => Promise<void>;
  resetApplication: () => Promise<void>;
  hardResetApplication: () => Promise<void>;
};

const DEBUG_LIMIT = 80;
const runtimeConfig = getRuntimeConfig();
const serverRepository = createServerMakershelfRepository();
const SERVER_DEVICE_SETTINGS_KEY = "makershelf-server-device-settings-v1";

const MakershelfContext = createContext<MakershelfContextValue | null>(null);

function isoNow() {
  return new Date().toISOString();
}

type ServerDeviceSettings = Pick<
  AppSettings,
  | "preferredSlicer"
  | "slicerExePaths"
  | "fusion360ExePath"
  | "freecadExePath"
  | "fileAssociations"
>;

function readServerDeviceSettings(): Partial<ServerDeviceSettings> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SERVER_DEVICE_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Partial<ServerDeviceSettings>) : {};
  } catch {
    return {};
  }
}

function mergeServerDeviceSettings(settings: AppSettings): AppSettings {
  const deviceSettings = readServerDeviceSettings();

  return {
    ...settings,
    ...deviceSettings,
    slicerExePaths: {
      ...settings.slicerExePaths,
      ...deviceSettings.slicerExePaths,
    },
    fileAssociations: {
      ...settings.fileAssociations,
      ...deviceSettings.fileAssociations,
    },
  };
}

function persistServerDeviceSettings(input: Partial<AppSettings>, current: AppSettings) {
  if (typeof window === "undefined") return;

  const hasDeviceSetting =
    input.preferredSlicer !== undefined ||
    input.slicerExePaths !== undefined ||
    input.fusion360ExePath !== undefined ||
    input.freecadExePath !== undefined ||
    input.fileAssociations !== undefined;

  if (!hasDeviceSetting) return;

  const existing = readServerDeviceSettings();
  const next: ServerDeviceSettings = {
    preferredSlicer: input.preferredSlicer ?? existing.preferredSlicer ?? current.preferredSlicer,
    slicerExePaths: {
      ...current.slicerExePaths,
      ...existing.slicerExePaths,
      ...input.slicerExePaths,
    },
    fusion360ExePath:
      input.fusion360ExePath ?? existing.fusion360ExePath ?? current.fusion360ExePath,
    freecadExePath:
      input.freecadExePath ?? existing.freecadExePath ?? current.freecadExePath,
    fileAssociations: {
      ...current.fileAssociations,
      ...existing.fileAssociations,
      ...input.fileAssociations,
    },
  };

  window.localStorage.setItem(SERVER_DEVICE_SETTINGS_KEY, JSON.stringify(next));
}

function getServerPersistedSettingsInput(input: Partial<AppSettings>): Partial<AppSettings> {
  const serverInput = { ...input };
  delete serverInput.appName;
  delete serverInput.dataBackend;
  delete serverInput.storageDriver;
  delete serverInput.setupCompleted;
  delete serverInput.slicerExePaths;
  delete serverInput.fusion360ExePath;
  delete serverInput.freecadExePath;
  delete serverInput.fileAssociations;

  return serverInput;
}

async function persistServerSettings(input: Partial<AppSettings>) {
  const serverInput = getServerPersistedSettingsInput(input);
  if (Object.keys(serverInput).length === 0) return;

  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serverInput),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Einstellungen konnten nicht gespeichert werden.");
  }
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function normalizeTags(tags: string[]) {
  return tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index);
}

function normalizeAuthorToCreatorName(author?: string) {
  return author?.trim().replace(/^by\s+/i, "") || "";
}

function findCreatorByName(creators: Creator[], author?: string) {
  const normalized = normalizeAuthorToCreatorName(author).toLowerCase();
  if (!normalized) return undefined;
  return creators.find((creator) => creator.name.trim().toLowerCase() === normalized);
}

function buildCreatorFoldersWithStableIds(existing: Creator | undefined, folderNames: string[]) {
  return folderNames
    .map((folder) => folder.trim())
    .filter(Boolean)
    .map((folder, index) => ({
      id: existing?.folders[index]?.id || slugify(folder) || makeId("folder"),
      name: folder,
    }));
}

function projectGradient(index: number) {
  const gradients = [
    "[background:linear-gradient(135deg,var(--primary),color-mix(in_srgb,var(--primary)_65%,white),var(--secondary))]",
    "[background:linear-gradient(135deg,var(--secondary),color-mix(in_srgb,var(--secondary)_75%,white),var(--primary))]",
    "[background:linear-gradient(135deg,color-mix(in_srgb,var(--secondary)_82%,black),var(--primary),color-mix(in_srgb,var(--secondary)_45%,white))]",
    "[background:linear-gradient(135deg,var(--primary),var(--secondary),color-mix(in_srgb,var(--primary)_45%,white))]",
  ];

  return gradients[index % gradients.length];
}

function sanitizeStorageSegment(value?: string, fallback = "unbenannt") {
  const cleaned = transliterateGerman(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\.+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function createEmptyServerSnapshot(): PersistedState {
  return {
    settings: {
      ...defaultSettings,
      setupCompleted: true,
    },
    categories: [],
    creators: [],
    projects: [],
    lists: [],
  };
}

function buildTransferSettingsForTarget(
  sourceSettings: AppSettings,
): Partial<AppSettings> {
  return {
    userName: sourceSettings.userName,
    language: sourceSettings.language,
    themeMode: sourceSettings.themeMode,
    primaryColor: sourceSettings.primaryColor,
    secondaryColor: sourceSettings.secondaryColor,
    preferredSlicer: sourceSettings.preferredSlicer,
    storageMode: defaultSettings.storageMode,
    storagePath: defaultSettings.storagePath,
    windowsLibraryPath: defaultSettings.windowsLibraryPath,
    debugMode: sourceSettings.debugMode,
    pageSize: sourceSettings.pageSize,
    dashboardFeaturedCount: sourceSettings.dashboardFeaturedCount,
    maxPreviewFileSizeMb: sourceSettings.maxPreviewFileSizeMb,
    setupCompleted: true,
  };
}

function createStoredPath(
  project: Pick<Project, "title" | "creatorId" | "creatorFolderId">,
  creators: Creator[],
  relativePath: string,
  fileType?: FileType,
) {
  const basePath = buildProjectStorageBasePath(project, creators);
  const normalized = relativePath.replace(/\\/g, "/");
  return `${basePath}/${getProjectFileStorageRelativePath(fileType, normalized)}`;
}

function getFileRelativePath(file: File, preserveFolderStructure = true) {
  const relativePath =
    preserveFolderStructure
      ? (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      : file.name;

  return relativePath.replace(/\\/g, "/").replace(/^\/+/g, "");
}

function toLocalFilesystemPath(settings: AppSettings, file: PrintFile) {
  const relativePath = file.storedPath.replace(/^Projects\//, "").replace(/\//g, "\\");
  const rootPath = (settings.storagePath || "Projects").replace(/[\\/]$/, "");
  return `${rootPath}\\${relativePath}`;
}

function syncProject(project: Project) {
  return {
    ...project,
    activity: {
      isActive: false,
      printedFileIds: [],
      steps: [],
      shoppingList: [],
      links: [],
      ...project.activity,
    },
    updatedAt: isoNow(),
  };
}

function fileToEntry(
  project: Pick<Project, "title" | "creatorId" | "creatorFolderId">,
  creators: Creator[],
  file: File,
  source: PrintFile["source"],
  overrides?: Partial<PrintFile>,
  options?: ProjectFileImportOptions,
): PrintFile {
  const normalizedPath = getFileRelativePath(file, options?.preserveFolderStructure ?? true);
  const fileType = detectFileType(normalizedPath);
  const storageRelativePath = getProjectFileStorageRelativePath(fileType, normalizedPath);

  return {
    id: makeId("file"),
    name: getBaseName(normalizedPath),
    originalName: getBaseName(normalizedPath),
    type: fileType,
    sizeBytes: file.size,
    sizeLabel: humanFileSize(file.size),
    mimeType: file.type,
    originalPath: normalizedPath,
    folderPath: getFolderPath(storageRelativePath),
    storedPath: createStoredPath(project, creators, normalizedPath, fileType),
    thumbnailUrl: undefined,
    notes: source === "zip" ? "Aus ZIP entpackt." : "Direkt importiert.",
    source,
    uploadedAt: isoNow(),
    ...overrides,
  };
}

async function extractArchiveWithServer(archiveFile: File) {
  const formData = new FormData();
  formData.append("archive", archiveFile);

  const response = await fetch("/api/archives/extract", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as ExtractedArchivePayload | null;

  if (!response.ok) {
    throw new Error(payload?.error || "Archiv konnte nicht entpackt werden.");
  }

  const files = (payload?.files ?? []).map((file) => {
    const bytes = new Uint8Array(file.data);
    return new File([bytes], file.name, {
      type: file.mimeType || "application/octet-stream",
    });
  });

  return {
    files,
    skipped: payload?.skipped ?? 0,
  };
}

async function prepareProjectUploadFiles(
  files: File[],
  source: PrintFile["source"],
  options?: ProjectFileImportOptions,
) {
  const preparedFiles: PreparedProjectUploadFile[] = [];
  let skipped = 0;
  const shouldExtractArchives = options?.extractArchives !== false;
  const archiveTotal = shouldExtractArchives
    ? files.filter((file) => isSupportedArchiveFile(file.name)).length
    : 0;
  let archiveIndex = 0;

  for (const file of files) {
    if (isSupportedArchiveFile(file.name)) {
      if (!shouldExtractArchives) {
        preparedFiles.push({ file, source });
        continue;
      }

      if (file.size > MAX_BROWSER_ARCHIVE_IMPORT_BYTES) {
        throw new Error(
          `Archiv ist für den direkten Browser-Import zu groß (${humanFileSize(file.size)}). Bitte lege es in den Server-Importordner und importiere es serverseitig.`,
        );
      }

      archiveIndex += 1;
      options?.onArchiveStatus?.(
        buildArchiveImportStatus({
          name: file.name,
          index: archiveIndex,
          total: archiveTotal,
          stage: "extracting",
        }),
      );
      const extracted = await extractArchiveWithServer(file);
      options?.onArchiveStatus?.(
        buildArchiveImportStatus({
          name: file.name,
          index: archiveIndex,
          total: archiveTotal,
          stage: "done",
          extractedCount: extracted.files.length,
          skippedCount: extracted.skipped,
        }),
      );
      skipped += extracted.skipped;

      if (extracted.files.length === 0) {
        skipped += 1;
        continue;
      }

      preparedFiles.push(
        ...extracted.files.map((extractedFile) => ({
          file: extractedFile,
          source: "zip" as const,
          extractedFromArchive: file.name,
        })),
      );
      continue;
    }

    if (isSupportedPrintFile(file.name)) {
      preparedFiles.push({ file, source });
      continue;
    }

    skipped += 1;
  }

  return { files: preparedFiles, skipped };
}

function extractUsefulUrls(input: string) {
  const schemaHosts = [
    "schemas.microsoft.com",
    "schemas.openxmlformats.org",
    "www.w3.org",
  ];

  return Array.from(
    new Set(
      Array.from(input.matchAll(/https?:\/\/[^\s"'<>]+/gi))
        .map((match) => match[0]?.trim())
        .filter(Boolean)
        .filter((candidate) => {
          try {
            const url = new URL(candidate!);
            return !schemaHosts.some((host) => url.hostname.includes(host));
          } catch {
            return false;
          }
        }) as string[],
    ),
  );
}

async function extract3mfMetadata(file: File): Promise<Parsed3mfMetadata | undefined> {
  try {
    const archive = await JSZip.loadAsync(file);

    // Thumbnail: Makerworld/Bambu stores it at Metadata/thumbnail.png or thumbnail.png
    let thumbnailDataUrl: string | undefined;
    const thumbnailEntry =
      archive.file("Metadata/thumbnail.png") ??
      archive.file("thumbnail.png") ??
      Object.values(archive.files).find(
        (entry) => !entry.dir && /thumbnail[^/]*\.png$/i.test(entry.name),
      );

    if (thumbnailEntry) {
      try {
        const blob = await thumbnailEntry.async("blob");
        thumbnailDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      } catch {
        // thumbnail extraction is best-effort
      }
    }

    const candidateEntries = Object.values(archive.files)
      .filter((entry) => !entry.dir)
      .filter((entry) =>
        /\.(model|xml|rels|json|config|cfg|ini|txt)$/i.test(entry.name),
      )
      .slice(0, 20);

    const discoveredUrls: string[] = [];
    let detectedTitle: string | undefined;
    let detectedDescription: string | undefined;

    for (const entry of candidateEntries) {
      const content = await entry.async("text");
      discoveredUrls.push(...extractUsefulUrls(content));

      // Makerworld/Bambu model_settings.config format:
      //   <metadata key="Title" value="My Model"/>
      //   <metadata key="Description" value="A description"/>
      // Also handles reversed attribute order and 3MF .model format:
      //   <Metadata Name="Title" Value="My Model"/>
      if (!detectedTitle) {
        const m =
          content.match(/key=["'](?:Title|title|ModelName)["'][^>]*value=["']([^"']{1,200})["']/i) ??
          content.match(/value=["']([^"']{1,200})["'][^>]*key=["'](?:Title|title|ModelName)["']/i) ??
          content.match(/(?:Name|name)=["'](?:Title|title)["'][^>]*(?:Value|value)=["']([^"']{1,200})["']/i);
        if (m?.[1]?.trim()) {
          detectedTitle = m[1].trim();
        }
      }

      if (!detectedDescription) {
        const m =
          content.match(/key=["'](?:Description|description)["'][^>]*value=["']([^"']{1,2000})["']/i) ??
          content.match(/value=["']([^"']{1,2000})["'][^>]*key=["'](?:Description|description)["']/i) ??
          content.match(/(?:Name|name)=["'](?:Description|description)["'][^>]*(?:Value|value)=["']([^"']{1,2000})["']/i);
        if (m?.[1]?.trim()) {
          detectedDescription = m[1].trim();
        }
      }
    }

    const sourceUrl = discoveredUrls[0];
    if (!sourceUrl && !detectedTitle && !detectedDescription && !thumbnailDataUrl) {
      return undefined;
    }

    return {
      sourceUrl,
      sourcePlatform: sourceUrl ? detectSourcePlatform(sourceUrl) : undefined,
      title: detectedTitle,
      description: detectedDescription,
      thumbnailDataUrl,
      note: sourceUrl ? `3MF-Metadaten erkannt: ${sourceUrl}` : undefined,
    };
  } catch {
    return undefined;
  }
}

function mergeFileNotes(base: string, additional?: string) {
  if (!additional) {
    return base;
  }

  return `${base}\n${additional}`;
}

function rebuildProjectFileStorage(
  project: Pick<Project, "title" | "creatorId" | "creatorFolderId" | "files">,
  creators: Creator[],
) {
  return project.files.map((file) => ({
    ...file,
    folderPath: getFolderPath(getProjectFileStorageRelativePath(file.type, file.originalPath || file.name)),
    storedPath: createStoredPath(project, creators, file.originalPath || file.name, file.type),
  }));
}

function computeDuplicates(projects: Project[]): DuplicateGroup[] {
  const map = new Map<string, DuplicateGroup["files"]>();

  projects.forEach((project) => {
    project.files.forEach((file) => {
      const key = `${file.originalName.toLowerCase()}::${file.sizeBytes}`;
      const existing = map.get(key) ?? [];
      existing.push({
        projectId: project.id,
        projectTitle: project.title,
        file,
      });
      map.set(key, existing);
    });
  });

  return Array.from(map.entries())
    .filter(([, files]) => files.length > 1)
    .map(([key, files]) => ({ key, files }));
}

function computeStats(
  categories: Category[],
  creators: Creator[],
  projects: Project[],
  lists: ProjectList[],
  duplicates: DuplicateGroup[],
): StatsSummary {
  const files = projects.flatMap((project) => project.files);
  const typeMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  files.forEach((file) => {
    typeMap.set(file.type, (typeMap.get(file.type) ?? 0) + 1);
  });

  projects.forEach((project) => {
    const category = categories.find((item) => item.id === project.categoryId);
    const key = category?.name ?? "Unkategorisiert";
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1);
  });

  return {
    totalProjects: projects.length,
    totalFiles: files.length,
    totalCategories: categories.length,
    totalCreators: creators.length,
    favoriteProjects: projects.filter((project) => project.favorite).length,
    customLists: lists.filter((list) => list.id !== "favorites").length,
    duplicateGroups: duplicates.length,
    zippedFiles: files.filter((file) => file.source === "zip" || file.type === "ZIP").length,
    websiteImports: projects.filter((project) => Boolean(project.sourceUrl)).length,
    indexedImports: files.filter((file) => file.source === "indexing").length,
    filesByType: Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    projectsByCategory: Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    largestFiles: files
      .slice()
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 5)
      .map((file) => {
        const project = projects.find((item) =>
          item.files.some((projectFile) => projectFile.id === file.id),
        );

        return {
          projectTitle: project?.title ?? "Unbekannt",
          fileName: file.name,
          sizeLabel: file.sizeLabel,
        };
      }),
  };
}

export function MakershelfProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() =>
    mergeServerDeviceSettings(normalizePersistedSettings(undefined)),
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lists, setLists] = useState<ProjectList[]>([]);
  const [debugLogs, setDebugLogs] = useState<DebugEntry[]>([]);
  const [backgroundJobs, setBackgroundJobs] = useState<BackgroundJob[]>([]);
  const lastProjectInfoSyncRef = useRef("");
  const [ready, setReady] = useState(false);

  const pushDebugLog = useCallback((message: string, level: DebugEntry["level"] = "info") => {
    const entry = {
      id: makeId("log"),
      level,
      message,
      at: new Date().toLocaleTimeString("de-DE"),
    };

    setDebugLogs((current) => [...current, entry].slice(-DEBUG_LIMIT));
    if (level === "error") {
      console.error(`[Makershelf] ${message}`);
    } else {
      console.info(`[Makershelf] ${message}`);
    }
  }, []);

  useEffect(() => {
    console.info("[Makershelf] Initializing client state");
    let finished = false;
    const readyFallback = window.setTimeout(() => {
      if (finished) {
        return;
      }
      pushDebugLog("Client state fallback activated after slow initialization", "error");
      setReady(true);
    }, 3500);

    void serverRepository
      .loadSnapshot()
      .then((parsed) => {
        if (!parsed) {
          pushDebugLog("No persisted state found, using defaults");
          setSettings(mergeServerDeviceSettings(normalizePersistedSettings(undefined)));
          setCategories([]);
          setCreators([]);
          setProjects([]);
          setLists([]);
          return;
        }

        setSettings(mergeServerDeviceSettings(normalizePersistedSettings(parsed.settings)));
        setCategories(parsed.categories ?? []);
        setCreators(parsed.creators ?? []);
        setProjects(normalizePersistedProjects(parsed.projects ?? []));
        setLists(parsed.lists ?? []);
        pushDebugLog("Persisted state restored");
      })
      .catch(() => {
        pushDebugLog("Persisted state could not be parsed, resetting to defaults", "error");
        setSettings(mergeServerDeviceSettings(normalizePersistedSettings(defaultSettings)));
        setCategories([]);
        setCreators([]);
        setProjects([]);
        setLists([]);
      })
      .finally(() => {
        finished = true;
        window.clearTimeout(readyFallback);
        pushDebugLog("Client state ready");
        setReady(true);
      });

    return () => {
      finished = true;
      window.clearTimeout(readyFallback);
    };
  }, [pushDebugLog]);

  useEffect(() => {
    if (!ready || settings.storageDriver !== "filesystem" || projects.length === 0) {
      return;
    }

    const syncPayload = {
      settings: {
        appName: settings.appName,
        storageMode: settings.storageMode,
        storagePath: settings.storagePath,
      },
      categories,
      creators,
      projects,
    };
    const syncHash = JSON.stringify(syncPayload);
    if (lastProjectInfoSyncRef.current === syncHash) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        const response = await fetch("/api/projects/makershelfinfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: syncHash,
        });

        if (response.ok) {
          lastProjectInfoSyncRef.current = syncHash;
          return;
        }

        if (response.status !== 401 && response.status !== 403) {
          const result = (await response.json().catch(() => null)) as { error?: string } | null;
          pushDebugLog(result?.error || "MakershelfInfo-Dateien konnten nicht geschrieben werden.", "error");
        }
      })().catch((error) => {
        pushDebugLog(
          error instanceof Error ? error.message : "MakershelfInfo-Dateien konnten nicht geschrieben werden.",
          "error",
        );
      });
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [categories, creators, projects, pushDebugLog, ready, settings]);

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.style.setProperty("--primary", settings.primaryColor);
      document.documentElement.style.setProperty("--secondary", settings.secondaryColor);
      document.documentElement.style.setProperty("--primary-soft", `${settings.primaryColor}18`);
      document.documentElement.style.setProperty(
        "--secondary-soft",
        `${settings.secondaryColor}18`,
      );

      const resolvedTheme =
        settings.themeMode === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : settings.themeMode;

      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    };

    applyTheme();

    if (settings.themeMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [settings]);

  const duplicates = useMemo(() => computeDuplicates(projects), [projects]);
  const stats = useMemo(
    () => computeStats(categories, creators, projects, lists, duplicates),
    [categories, creators, duplicates, lists, projects],
  );

  const uploadFilesToFilesystem = useCallback(
    async (
      projectId: string,
      descriptors: StoredUploadDescriptor[],
      options?: {
        storageMode?: AppSettings["storageMode"];
        storagePath?: string;
        onProgress?: ProjectFileImportProgressCallback;
        onFileStatus?: (name: string, index: number, total: number) => void;
      },
    ) => {
      if (descriptors.length === 0) {
        return [];
      }

      const effectiveStorageMode = options?.storageMode ?? settings.storageMode;
      const effectiveStoragePath = options?.storagePath ?? settings.storagePath;
      const total = descriptors.length;
      const allFiles: PrintFile[] = [];

      for (let index = 0; index < total; index += 1) {
        const { file, entry } = descriptors[index];

        options?.onFileStatus?.(entry.name, index, total);

        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("storageMode", effectiveStorageMode);
        formData.set("storagePath", effectiveStoragePath);
        formData.set(
          "manifest",
          JSON.stringify([{
            id: entry.id,
            name: entry.name,
            originalName: entry.originalName,
            type: entry.type,
            mimeType: entry.mimeType,
            sizeBytes: entry.sizeBytes,
            storedPath: entry.storedPath,
            originalPath: entry.originalPath,
            folderPath: entry.folderPath,
            notes: entry.notes,
            source: entry.source,
            extractedFromZip: entry.extractedFromZip,
          }]),
        );
        formData.append("files", file, file.name);

        const payload = await new Promise<{ files?: PrintFile[]; error?: string }>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", "/api/files");
          request.responseType = "json";

          request.upload.onprogress = (event) => {
            if (!event.lengthComputable) {
              return;
            }
            const fileProgress = event.loaded / Math.max(event.total, 1);
            options?.onProgress?.((index + fileProgress) / total);
          };

          request.onerror = () => {
            reject(new Error("Dateien konnten nicht auf dem Dateisystem gespeichert werden."));
          };

          request.onload = () => {
            const responsePayload =
              typeof request.response === "object" && request.response
                ? (request.response as { files?: PrintFile[]; error?: string })
                : { error: "Dateien konnten nicht auf dem Dateisystem gespeichert werden." };

            if (request.status < 200 || request.status >= 300) {
              reject(
                new Error(
                  responsePayload.error || "Dateien konnten nicht auf dem Dateisystem gespeichert werden.",
                ),
              );
              return;
            }

            options?.onProgress?.((index + 1) / total);
            resolve(responsePayload);
          };

          request.send(formData);
        });

        allFiles.push(...(payload.files ?? []));
      }

      return allFiles;
    },
    [settings.storageMode, settings.storagePath],
  );

  const readFilesystemFileBlob = useCallback(
    async (file: PrintFile) => {
      const params = new URLSearchParams();
      params.set("name", file.name);
      params.set("mimeType", file.mimeType || "application/octet-stream");
      params.set("fileId", file.id);

      const response = await fetch(`/api/files?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          payload?.error || `Datei konnte nicht vom Dateisystem geladen werden. HTTP ${response.status}`,
        );
      }

      return response.blob();
    },
    [],
  );

  const moveFilesystemFiles = useCallback(
    async (
      moves: StoredFileMoveDescriptor[],
      options?: {
        sourceStorageMode?: AppSettings["storageMode"];
        sourceStoragePath?: string;
        targetStorageMode?: AppSettings["storageMode"];
        targetStoragePath?: string;
      },
    ) => {
      const sourceStorageMode = options?.sourceStorageMode ?? settings.storageMode;
      const sourceStoragePath = options?.sourceStoragePath ?? settings.storagePath;
      const targetStorageMode = options?.targetStorageMode ?? settings.storageMode;
      const targetStoragePath = options?.targetStoragePath ?? settings.storagePath;
      const relevantMoves = moves.filter(
        (move) =>
          move.oldStoredPath.trim() &&
          move.newStoredPath.trim() &&
          (move.oldStoredPath !== move.newStoredPath ||
            sourceStorageMode !== targetStorageMode ||
            sourceStoragePath !== targetStoragePath),
      );

      if (relevantMoves.length === 0) {
        return;
      }

      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moves: relevantMoves,
          sourceStorageMode,
          sourceStoragePath,
          targetStorageMode,
          targetStoragePath,
        }),
      });

      const result = await parseJsonResponse<{ ok?: boolean; error?: string; errors?: string[] }>(
        response,
        "Dateien konnten nicht in die neue Struktur verschoben werden.",
      );
      if (!response.ok || result.ok === false) {
        const details = result.errors?.length ? `\n${result.errors.join("\n")}` : "";
        throw new Error(
          `${result.error || "Dateien konnten nicht in die neue Struktur verschoben werden."}${details}`,
        );
      }
    },
    [settings.storageMode, settings.storagePath],
  );

  const dismissBackgroundJob = useCallback((jobId: string) => {
    setBackgroundJobs((current) => current.filter((job) => job.id !== jobId));
  }, []);

  const updateBackgroundJob = useCallback((jobId: string, patch: Partial<BackgroundJob>) => {
    setBackgroundJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              ...patch,
              progress:
                typeof patch.progress === "number"
                  ? Math.min(1, Math.max(0, patch.progress))
                  : job.progress,
              updatedAt: isoNow(),
            }
          : job,
      ),
    );
  }, []);

  const enqueueFilesystemMoveJob = useCallback(
    (
      input: {
        label: string;
        projectId?: string;
        projectTitle?: string;
        moves: StoredFileMoveDescriptor[];
        onComplete?: () => void;
      },
      options?: {
        sourceStorageMode?: AppSettings["storageMode"];
        sourceStoragePath?: string;
        targetStorageMode?: AppSettings["storageMode"];
        targetStoragePath?: string;
      },
    ) => {
      const sourceStorageMode = options?.sourceStorageMode ?? settings.storageMode;
      const sourceStoragePath = options?.sourceStoragePath ?? settings.storagePath;
      const targetStorageMode = options?.targetStorageMode ?? settings.storageMode;
      const targetStoragePath = options?.targetStoragePath ?? settings.storagePath;
      const moves = input.moves.filter(
        (move) =>
          move.oldStoredPath.trim() &&
          move.newStoredPath.trim() &&
          (move.oldStoredPath !== move.newStoredPath ||
            sourceStorageMode !== targetStorageMode ||
            sourceStoragePath !== targetStoragePath),
      );

      if (moves.length === 0) {
        input.onComplete?.();
        return;
      }

      const jobId = makeId("job");
      const createdAt = isoNow();
      setBackgroundJobs((current) => [
        {
          id: jobId,
          type: "filesystem-move",
          label: input.label,
          projectId: input.projectId,
          projectTitle: input.projectTitle,
          status: "queued",
          progress: 0,
          processed: 0,
          total: moves.length,
          message: "Wartet auf Start",
          createdAt,
          updatedAt: createdAt,
        },
        ...current,
      ]);

      void (async () => {
        try {
          updateBackgroundJob(jobId, {
            status: "running",
            message: "Struktur wird im Hintergrund angepasst",
          });

          const chunkSize = 10;
          for (let index = 0; index < moves.length; index += chunkSize) {
            const chunk = moves.slice(index, index + chunkSize);
            await moveFilesystemFiles(chunk, options);
            const processed = Math.min(index + chunk.length, moves.length);
            updateBackgroundJob(jobId, {
              processed,
              progress: processed / moves.length,
              message: `Verschiebe Dateien (${processed}/${moves.length})`,
            });
          }

          input.onComplete?.();
          updateBackgroundJob(jobId, {
            status: "completed",
            processed: moves.length,
            progress: 1,
            message: "Strukturaenderung abgeschlossen",
          });
          pushDebugLog(`Background job completed: ${input.label}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unbekannter Fehler";
          updateBackgroundJob(jobId, {
            status: "failed",
            error: message,
            message: "Strukturaenderung fehlgeschlagen",
          });
          pushDebugLog(`Background job failed: ${input.label} - ${message}`, "error");
        }
      })();
    },
    [moveFilesystemFiles, pushDebugLog, settings.storageMode, settings.storagePath, updateBackgroundJob],
  );

  const deleteFilesystemFiles = useCallback(
    async (filesToDelete: PrintFile[]) => {
      if (filesToDelete.length === 0) {
        return;
      }

      const payload = { fileIds: filesToDelete.map((file) => file.id) };

      const response = await fetch("/api/files", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await parseJsonResponse<{ ok?: boolean; error?: string }>(
        response,
        "Dateien konnten nicht vom Dateisystem entfernt werden.",
      );
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "Dateien konnten nicht vom Dateisystem entfernt werden.");
      }
    },
    [],
  );

  const clearAncillaryClientStorage = useCallback(async () => {
    try {
      window.localStorage.removeItem("makershelf-indexing-session-v1");
    } catch {
      // ignore local cleanup failures
    }

    await deleteStoredFilesByPrefix("makershelf-indexing:").catch(() => undefined);
  }, []);

  const clearCurrentWorkspaceLibrary = useCallback(async () => {
    const response = await fetch("/api/data/transfer", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const payload = await parseJsonResponse<{ ok?: boolean; error?: string }>(
      response,
      "Workspace-Inhalte konnten nicht geleert werden.",
    );
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "Workspace-Inhalte konnten nicht geleert werden.");
    }
  }, []);

  const applyImportedSettingsToServer = useCallback(
    async (nextSettings: Partial<AppSettings>) => {
      const response = await fetch("/api/data/transfer", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings: nextSettings }),
      });
      const payload = await parseJsonResponse<{ ok?: boolean; error?: string }>(
        response,
        "Server-Einstellungen konnten nicht aktualisiert werden.",
      );
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Server-Einstellungen konnten nicht aktualisiert werden.");
      }
    },
    [],
  );

  const ensureCreatorForAuthor = useCallback(async (author?: string, preferredCreatorId?: string) => {
    if (preferredCreatorId) {
      return preferredCreatorId;
    }

    const authorName = normalizeAuthorToCreatorName(author);
    if (!authorName) {
      return undefined;
    }

    const existingCreator = findCreatorByName(creators, authorName);
    if (existingCreator) {
      return existingCreator.id;
    }

    const response = await fetch("/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: authorName, folders: [] }),
    });
    if (!response.ok) {
      throw new Error("Creator could not be created on the server.");
    }
    const created = (await response.json()) as Creator;
    setCreators((current) => [...current, created]);
    pushDebugLog(`Creator created: ${created.name}`);
    return created.id;
  }, [creators, pushDebugLog]);

  const ensureCategoryForWebsiteMetadata = useCallback(async (metadata: WebsiteImportMetadata) => {
    const explicitCategory = metadata.category?.trim();
    if (explicitCategory) {
      const existingCategory = categories.find(
        (category) => category.name.toLowerCase() === explicitCategory.toLowerCase(),
      );
      if (existingCategory) {
        return existingCategory.id;
      }

      const input: CategoryInput = {
        name: explicitCategory,
        description: "Automatisch aus Website-Metadaten übernommen.",
        emoji: "🏷️",
        color: settings.primaryColor,
      };

      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error("Category could not be created on the server.");
      }
      const created = (await response.json()) as Category;
      setCategories((current) => [...current, created]);
      pushDebugLog(`Category created from website category: ${created.name}`);
      return created.id;
    }

    const tagText = normalizeTags(metadata.tags ?? [])
      .join(" ")
      .toLowerCase();
    const sourceText = `${metadata.title ?? ""} ${metadata.description ?? ""}`.toLowerCase();
    const searchableText = `${tagText} ${sourceText}`;

    const categoryMatch =
      [
        {
          name: "Cosplay",
          emoji: "🛡️",
          color: "#ef4444",
          keywords: ["cosplay", "helmet", "mask", "prop", "armor", "armour", "wearable"],
        },
        {
          name: "Miniaturen",
          emoji: "🧙",
          color: "#8b5cf6",
          keywords: ["miniature", "miniatures", "figure", "figurine", "terrain", "diorama", "tabletop", "rpg"],
        },
        {
          name: "Organisation",
          emoji: "🗃️",
          color: "#10b981",
          keywords: ["organizer", "storage", "box", "holder", "stand", "rack", "drawer"],
        },
        {
          name: "Technische Teile",
          emoji: "🛠️",
          color: "#f97316",
          keywords: ["functional", "adapter", "mount", "bracket", "tool", "part", "repair"],
        },
      ].find((candidate) =>
        candidate.keywords.some((keyword) => searchableText.includes(keyword)),
      ) ?? null;

    if (!categoryMatch) {
      return undefined;
    }

    const existingCategory = categories.find(
      (category) => category.name.toLowerCase() === categoryMatch.name.toLowerCase(),
    );
    if (existingCategory) {
      return existingCategory.id;
    }

    const input: CategoryInput = {
      name: categoryMatch.name,
      description: "Automatisch aus Website-Metadaten erkannt.",
      emoji: categoryMatch.emoji,
      color: categoryMatch.color,
    };

    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error("Category could not be created on the server.");
    }
    const created = (await response.json()) as Category;
    setCategories((current) => [...current, created]);
    pushDebugLog(`Category created from website metadata: ${created.name}`);
    return created.id;
  }, [categories, pushDebugLog, settings.primaryColor]);

  const addRemoteFilesToProjectImpl = useCallback(
    async (projectId: string, files: RemoteImportFile[], source: PrintFile["source"] = "website") => {
      const remoteFiles = files.map(
        (file) =>
          new File([new Uint8Array(file.data)], file.name, {
            type: file.mimeType || "application/octet-stream",
          }),
      );

      const supportedFiles: File[] = [];
      let skipped = 0;

      for (const remoteFile of remoteFiles) {
        if (isSupportedPrintFile(remoteFile.name)) {
          supportedFiles.push(remoteFile);
          continue;
        }

        if (isSupportedArchiveFile(remoteFile.name)) {
          const extracted = await extractArchiveWithServer(remoteFile);
          skipped += extracted.skipped;
          if (extracted.files.length) {
            supportedFiles.push(...extracted.files);
          } else {
            skipped += 1;
          }
          continue;
        }

        skipped += 1;
      }

      if (supportedFiles.length === 0) {
        pushDebugLog("No supported remote project files found in link import", "error");
        return { added: 0, skipped };
      }

      const project =
        projects.find((item) => item.id === projectId) ??
        ({
          title: "Project",
          creatorId: undefined,
          creatorFolderId: undefined,
        } satisfies Pick<Project, "title" | "creatorId" | "creatorFolderId">);

      const entries = supportedFiles.map((file) => fileToEntry(project, creators, file, source));

      const storedFiles = await uploadFilesToFilesystem(
        projectId,
        entries.map((entry, index) => ({
          entry,
          file: supportedFiles[index],
        })),
      );

      setProjects((current) =>
        current.map((project) => {
          if (project.id !== projectId) return project;
          const projectEntries = storedFiles.map((entry) => ({
            ...entry,
            folderPath: getFolderPath(getProjectFileStorageRelativePath(entry.type, entry.originalPath || entry.name)),
            storedPath: createStoredPath(project, creators, entry.originalPath || entry.name, entry.type),
          }));

          return syncProject({
            ...project,
            files: [...projectEntries, ...project.files],
            thumbnailFileId: project.thumbnailFileId ?? projectEntries[0]?.id,
          });
        }),
      );

      pushDebugLog(`Added ${supportedFiles.length} remote files to project ${projectId}`);
      return { added: supportedFiles.length, skipped };
    },
    [creators, projects, pushDebugLog, uploadFilesToFilesystem],
  );

  const exportTransferBundle = useCallback(async () => {
    const archive = new JSZip();
    const fileEntries: Record<string, string> = {};
    const snapshot: MakershelfSnapshot = {
      settings,
      categories,
      creators,
      projects,
      lists,
    };

    for (const project of projects) {
      for (const file of project.files) {
        const blob = await readFilesystemFileBlob(file);

        if (!blob) {
          pushDebugLog(`Datei ${file.name} konnte nicht in den Export aufgenommen werden.`, "error");
          continue;
        }

        const relativeName = sanitizeStorageSegment(file.originalName || file.name, "datei");
        const archivePath = `files/${project.id}/${file.id}-${relativeName}`;
        archive.file(archivePath, blob);
        fileEntries[file.id] = archivePath;
      }
    }

    const manifest: TransferBundleManifest = {
      version: 1,
      exportedAt: isoNow(),
      snapshot,
      fileEntries,
    };

    archive.file("manifest.json", JSON.stringify(manifest, null, 2));

    const blob = await archive.generateAsync({ type: "blob" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `makershelf-transfer-${new Date()
      .toISOString()
      .slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    pushDebugLog("Transferpaket exportiert");
  }, [
    categories,
    creators,
    lists,
    projects,
    pushDebugLog,
    readFilesystemFileBlob,
    settings,
  ]);

  const importTransferBundle = useCallback(
    async (bundleFile: File) => {
      const archive = await JSZip.loadAsync(bundleFile);
      const manifestRaw = await archive.file("manifest.json")?.async("text");

      if (!manifestRaw) {
        throw new Error("Im Transferpaket fehlt die manifest.json.");
      }

      const manifest = JSON.parse(manifestRaw) as TransferBundleManifest;
      if (manifest.version !== 1 || !manifest.snapshot) {
        throw new Error("Das Transferpaket hat ein unbekanntes Format.");
      }

      const importedSettings = buildTransferSettingsForTarget(
        manifest.snapshot.settings,
      );

      await clearCurrentWorkspaceLibrary();
      await applyImportedSettingsToServer(importedSettings);

        const createdCategories: Category[] = [];
        const categoryIdMap = new Map<string, string>();

        for (const category of manifest.snapshot.categories) {
          const response = await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: category.name,
              description: category.description,
              emoji: category.emoji,
              color: category.color,
            }),
          });

          if (!response.ok) {
            throw new Error("Category could not be imported.");
          }

          const created = (await response.json()) as Category;
          createdCategories.push(created);
          categoryIdMap.set(category.id, created.id);
        }

        const createdCreators: Creator[] = [];
        const creatorIdMap = new Map<string, string>();
        const creatorFolderIdMap = new Map<string, string>();

        for (const creator of manifest.snapshot.creators) {
          const response = await fetch("/api/creators", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: creator.name,
              folders: creator.folders.map((folder) => folder.name),
            }),
          });

          if (!response.ok) {
            throw new Error("Creator konnte nicht importiert werden.");
          }

          const created = (await response.json()) as Creator;
          createdCreators.push(created);
          creatorIdMap.set(creator.id, created.id);

          creator.folders.forEach((folder) => {
            const matchingFolder = created.folders.find((entry) => entry.name === folder.name);
            if (matchingFolder) {
              creatorFolderIdMap.set(folder.id, matchingFolder.id);
            }
          });
        }

        const createdProjects: Project[] = [];
        const projectIdMap = new Map<string, string>();

        for (const project of manifest.snapshot.projects) {
          const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: project.title,
              description: project.description,
              categoryId: categoryIdMap.get(project.categoryId) || "",
              license: project.license,
              tags: project.tags,
              author: project.author,
              sourceUrl: project.sourceUrl || "",
              coverImage: project.coverImage || "",
              creatorId: creatorIdMap.get(project.creatorId || "") || "",
              creatorFolderId: creatorFolderIdMap.get(project.creatorFolderId || "") || "",
              lockedFields: project.lockedFields,
              activity: project.activity,
            }),
          });

          if (!response.ok) {
            throw new Error(`Projekt "${project.title}" konnte nicht importiert werden.`);
          }

          const created = (await response.json()) as { id: string; createdByName?: string };
          projectIdMap.set(project.id, created.id);

          const recreatedProject: Project = {
            ...project,
            id: created.id,
            categoryId: categoryIdMap.get(project.categoryId) || project.categoryId,
            creatorId: creatorIdMap.get(project.creatorId || "") || undefined,
            creatorFolderId:
              creatorFolderIdMap.get(project.creatorFolderId || "") || undefined,
            createdByName: created.createdByName || project.createdByName,
          };

          const uploadManifest: PrintFile[] = [];
          const uploadFiles: File[] = [];

          for (const projectFile of project.files) {
            const archivePath = manifest.fileEntries[projectFile.id];
            if (!archivePath) {
              continue;
            }

            const archivedEntry = archive.file(archivePath);
            if (!archivedEntry) {
              continue;
            }

            const blob = await archivedEntry.async("blob");
            const importFile = new File([blob], projectFile.originalPath || projectFile.name, {
              type: projectFile.mimeType || blob.type || "application/octet-stream",
            });

            uploadManifest.push({
              ...projectFile,
              folderPath: getFolderPath(getProjectFileStorageRelativePath(projectFile.type, projectFile.originalPath || projectFile.name)),
              storedPath: createStoredPath(
                recreatedProject,
                createdCreators,
                projectFile.originalPath || projectFile.name,
                projectFile.type,
              ),
            });
            uploadFiles.push(importFile);
          }

          if (uploadFiles.length > 0) {
            const formData = new FormData();
            formData.set("projectId", created.id);
            formData.set("storageMode", settings.storageMode);
            formData.set("storagePath", settings.storagePath);
            formData.set(
              "manifest",
              JSON.stringify(
                uploadManifest.map((entry) => ({
                  id: entry.id,
                  name: entry.name,
                  originalName: entry.originalName,
                  type: entry.type,
                  mimeType: entry.mimeType,
                  sizeBytes: entry.sizeBytes,
                  storedPath: entry.storedPath,
                  originalPath: entry.originalPath,
                  folderPath: entry.folderPath,
                  notes: entry.notes,
                  source: entry.source,
                  extractedFromZip: entry.extractedFromZip,
                })),
              ),
            );

            uploadFiles.forEach((uploadFile) => {
              formData.append("files", uploadFile, uploadFile.name);
            });

            const uploadResponse = await fetch("/api/files", {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Dateien für "${project.title}" konnten nicht importiert werden.`);
            }

            const uploadedPayload = (await uploadResponse.json()) as { files?: PrintFile[] };
            recreatedProject.files = uploadedPayload.files ?? [];
            recreatedProject.thumbnailFileId =
              recreatedProject.files.find((file) => file.id === project.thumbnailFileId)?.id ||
              recreatedProject.files[0]?.id;
          } else {
            recreatedProject.files = [];
            recreatedProject.thumbnailFileId = undefined;
          }

          createdProjects.push(recreatedProject);
        }

        const createdLists: ProjectList[] = [];
        for (const list of manifest.snapshot.lists.filter((entry) => entry.id !== "favorites")) {
          const response = await fetch("/api/lists", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: list.name }),
          });

          if (!response.ok) {
            throw new Error(`Liste "${list.name}" konnte nicht importiert werden.`);
          }

          const created = (await response.json()) as ProjectList;

          for (const projectId of list.projectIds) {
            const mappedProjectId = projectIdMap.get(projectId);
            if (!mappedProjectId) {
              continue;
            }

            await fetch(`/api/lists/${created.id}/entries`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: mappedProjectId }),
            });
          }

          createdLists.push({
            ...created,
            projectIds: list.projectIds
              .map((projectId) => projectIdMap.get(projectId))
              .filter((value): value is string => Boolean(value)),
          });
        }

      setSettings((current) =>
        normalizePersistedSettings(
          {
            ...current,
            ...importedSettings,
          },
          {
            dataBackend: current.dataBackend,
            storageDriver: current.storageDriver,
          },
        ),
      );
      setCategories(createdCategories);
      setCreators(createdCreators);
      setProjects(createdProjects);
      setLists(createdLists);
      pushDebugLog("Transferpaket in Server-Workspace importiert");
    },
    [
      applyImportedSettingsToServer,
      clearCurrentWorkspaceLibrary,
      pushDebugLog,
      settings,
    ],
  );

  const hardResetApplication = useCallback(async () => {
    await clearAncillaryClientStorage();

    const response = await fetch("/api/system/reset", {
      method: "POST",
    });
    const payload = await parseJsonResponse<{ ok?: boolean; error?: string }>(
      response,
      "System konnte nicht auf Werkseinstellungen gesetzt werden.",
    );
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "System konnte nicht auf Werkseinstellungen gesetzt werden.");
    }

    pushDebugLog("Server-Werksreset ausgefuehrt");
    window.location.href = "/setup";
  }, [
    clearAncillaryClientStorage,
    pushDebugLog,
  ]);

  const refreshServerSnapshot = useCallback(async () => {
    const parsed = await serverRepository.loadSnapshot();
    if (!parsed) {
      return;
    }

    setSettings((current) =>
      mergeServerDeviceSettings(
        normalizePersistedSettings(parsed.settings, {
          dataBackend: settings.dataBackend,
          storageDriver: "filesystem",
        }) || current,
      ),
    );
    setCategories(parsed.categories ?? []);
    setCreators(parsed.creators ?? []);
    setProjects(normalizePersistedProjects(parsed.projects ?? []));
    setLists(parsed.lists ?? []);
    pushDebugLog("Server-Snapshot aktualisiert");
  }, [pushDebugLog, settings.dataBackend]);

  const value = useMemo<MakershelfContextValue>(
    () => ({
      ready,
      settings,
      categories,
      creators,
      projects,
      lists,
      duplicates,
      stats,
      debugLogs,
      backgroundJobs,
      dismissBackgroundJob,
      async completeSetup(_input) {
        // Server setup happens via /api/system/bootstrap from the setup wizard.
        // This client-side completeSetup is a no-op now.
        pushDebugLog("Initial setup completed");
        void _input;
      },
      async updateSettings(input) {
        const nextSettings: AppSettings = {
          ...settings,
          ...input,
          showBuyMeACoffeeButton: true,
          buyMeACoffeeUrl:
            input.buyMeACoffeeUrl?.trim() ||
            settings.buyMeACoffeeUrl ||
            defaultSettings.buyMeACoffeeUrl,
          enableExperimentalWebsiteImport: true,
          storageDriver: "filesystem",
          dataBackend:
            input.dataBackend ??
            (settings.dataBackend === "browser" ? "postgres" : settings.dataBackend),
        };

        persistServerDeviceSettings(input, settings);
        setSettings(nextSettings);
        try {
          await persistServerSettings(input);
          pushDebugLog("Settings updated");
        } catch (error) {
          setSettings(settings);
          pushDebugLog(
            error instanceof Error ? error.message : "Einstellungen konnten nicht gespeichert werden.",
            "error",
          );
          throw error;
        }
      },
      async createCategory(input) {
        const response = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error("Category could not be created on the server.");
        }
        const created = (await response.json()) as Category;
        setCategories((current) => [...current, created]);
        pushDebugLog(`Category created: ${created.name}`);
        return created.id;
      },
      updateCategory(categoryId, input) {
        setCategories((current) =>
          current.map((category) =>
            category.id === categoryId ? { ...category, ...input } : category,
          ),
        );
        pushDebugLog(`Category updated: ${categoryId}`);
      },
      async deleteCategory(categoryId) {
        const response = await fetch(`/api/categories/${categoryId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Category could not be deleted on the server.");
        }

        setCategories((current) =>
          current.filter((category) => category.id !== categoryId),
        );
        setProjects((current) =>
          current.map((project) =>
            project.categoryId === categoryId
              ? { ...project, categoryId: defaultCategories[0].id }
              : project,
          ),
        );
        pushDebugLog(`Category deleted: ${categoryId}`);
      },
      async createCreator(input) {
        const response = await fetch("/api/creators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            folders: input.folders.map((folder) => folder.trim()).filter(Boolean),
          }),
        });
        if (!response.ok) {
          throw new Error("Creator could not be created on the server.");
        }
        const created = (await response.json()) as Creator;
        setCreators((current) => [...current, created]);
        pushDebugLog(`Creator created: ${created.name}`);
        return created.id;
      },
      async updateCreator(creatorId, input) {
        const response = await fetch(`/api/creators/${creatorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            folders: input.folders.map((folder) => folder.trim()).filter(Boolean),
          }),
        });
        if (!response.ok) {
          throw new Error("Creator could not be updated on the server.");
        }
        const updated = (await response.json()) as Creator;
        setCreators((current) =>
          current.map((creator) => (creator.id === creatorId ? updated : creator)),
        );
        pushDebugLog(`Creator updated: ${updated.name}`);
      },
      async deleteCreator(creatorId) {
        const response = await fetch(`/api/creators/${creatorId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Creator could not be deleted on the server.");
        }

        setCreators((current) =>
          current.filter((creator) => creator.id !== creatorId),
        );
        setProjects((current) =>
          current.map((project) =>
            project.creatorId === creatorId
              ? {
                  ...project,
                  creatorId: undefined,
                  creatorFolderId: undefined,
                  files: project.files,
                }
              : project,
          ),
        );
        pushDebugLog(`Creator deleted: ${creatorId}`);
      },
      async createProject(input) {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Project could not be created on the server.");
        }
        const created = (await response.json()) as { id: string; createdByName?: string };
        const createdByName = created.createdByName || settings.userName || "Unknown";
        setProjects((current) => [
          {
            id: created.id,
            title: input.title,
            description: input.description,
            coverLabel: input.title.slice(0, 8).toUpperCase(),
            coverGradient: projectGradient(current.length),
            tags: normalizeTags(input.tags),
            categoryId: input.categoryId,
            creatorId: input.creatorId || undefined,
            creatorFolderId: input.creatorFolderId || undefined,
            license: input.license,
            author: input.author || settings.userName || "Unknown",
            sourceUrl: input.sourceUrl,
            sourcePlatform: detectSourcePlatform(input.sourceUrl),
            coverImage: input.coverImage,
            lockedFields: input.lockedFields ?? [],
            favorite: false,
            createdByName,
            createdAt: isoNow(),
            updatedAt: isoNow(),
            files: [],
            activity: input.activity ?? {
              isActive: false,
              printedFileIds: [],
              steps: [],
              shoppingList: [],
              links: [],
            },
          },
          ...current,
        ]);
        pushDebugLog(`Project created: ${input.title}`);
        return created.id;
      },
      async createProjectWithFiles(input, files, source = "upload", optionsOrProgress, onProgress) {
        const importOptions =
          typeof optionsOrProgress === "function" ? undefined : optionsOrProgress;
        const progressCallback =
          typeof optionsOrProgress === "function" ? optionsOrProgress : onProgress;
        const fileList = Array.from(files);
        const preparedUpload = await prepareProjectUploadFiles(fileList, source, importOptions);
        const supportedFiles = preparedUpload.files;
        const skipped = preparedUpload.skipped;
        progressCallback?.(0);

        const effectiveStorageMode = settings.storageMode;
        const effectiveStoragePath = settings.storagePath.trim() || "Projects";
        const shouldUseFilesystem = true;

        const baseId = slugify(input.title) || makeId("project");
        const resolvedId = projects.some((project) => project.id === baseId)
          ? makeId("project")
          : baseId;
        const author = input.author || settings.userName || "Unknown";

        const baseProject = {
          id: resolvedId,
          title: input.title,
          description: input.description,
          coverLabel: input.title.slice(0, 8).toUpperCase(),
          coverGradient: projectGradient(projects.length),
          tags: normalizeTags(input.tags),
          categoryId: input.categoryId,
          creatorId: input.creatorId || undefined,
          creatorFolderId: input.creatorFolderId || undefined,
          license: input.license,
          author,
          sourceUrl: input.sourceUrl,
          sourcePlatform: detectSourcePlatform(input.sourceUrl),
          coverImage: input.coverImage,
          lockedFields: input.lockedFields ?? [],
          favorite: false,
          createdByName: settings.userName || "Unknown",
          createdAt: isoNow(),
          updatedAt: isoNow(),
          files: [] as PrintFile[],
          activity: input.activity ?? {
            isActive: false,
            printedFileIds: [],
            steps: [],
            shoppingList: [],
            links: [],
          },
        } satisfies Project;

        let projectId = resolvedId;
        let createdByName = settings.userName || "Unknown";
        let createdOnServer = false;

        {
          const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error || "Project could not be created on the server.");
          }

          const created = (await response.json()) as { id: string; createdByName?: string };
          projectId = created.id;
          createdByName = created.createdByName || createdByName;
          createdOnServer = true;
        }
        try {
          const fileDescriptors: Array<{
            file: File;
            detectedMetadata?: Parsed3mfMetadata;
            entry: PrintFile;
          }> = [];

          for (let index = 0; index < supportedFiles.length; index += 1) {
            const preparedFile = supportedFiles[index];
            const file = preparedFile.file;
            const detectedMetadata =
              detectFileType(file.name) === "3MF" ? await extract3mfMetadata(file) : undefined;

            fileDescriptors.push({
              file,
              detectedMetadata,
              entry: fileToEntry(
                {
                  title: input.title,
                  creatorId: input.creatorId || undefined,
                  creatorFolderId: input.creatorFolderId || undefined,
                },
                creators,
                file,
                preparedFile.source,
                {
                  extractedFromZip: preparedFile.extractedFromArchive,
                  notes: mergeFileNotes(
                    preparedFile.extractedFromArchive
                      ? `Aus Archiv ${preparedFile.extractedFromArchive} entpackt.`
                      : preparedFile.source === "zip"
                        ? "Aus ZIP entpackt."
                        : "Direkt importiert.",
                    detectedMetadata?.note,
                  ),
                },
                importOptions,
              ),
            });

            if (supportedFiles.length) {
              progressCallback?.(0.08 + ((index + 1) / supportedFiles.length) * 0.32);
            }

            if ((index + 1) % 5 === 0 || index === supportedFiles.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          progressCallback?.(supportedFiles.length ? 0.45 : 0.55);

          const storedFiles =
            supportedFiles.length === 0
              ? []
              : await uploadFilesToFilesystem(
                  projectId,
                  fileDescriptors.map(({ entry, file }) => ({
                    entry,
                    file,
                  })),
                  {
                    storageMode: effectiveStorageMode,
                    storagePath: effectiveStoragePath,
                    onProgress: (progress) => {
                      progressCallback?.(0.45 + progress * 0.4);
                    },
                    onFileStatus: importOptions?.onFileStatus,
                  },
                );

          if (supportedFiles.length > 0) {
            progressCallback?.(0.85);
          }
          void shouldUseFilesystem;

          const detectedSourceUrl = fileDescriptors.find((item) => item.detectedMetadata?.sourceUrl)
            ?.detectedMetadata?.sourceUrl;
          const detectedSourcePlatform = detectedSourceUrl
            ? detectSourcePlatform(detectedSourceUrl)
            : undefined;
          const detectedDescription = fileDescriptors.find((item) => item.detectedMetadata?.description)
            ?.detectedMetadata?.description;
          const detectedThumbnail = fileDescriptors.find((item) => item.detectedMetadata?.thumbnailDataUrl)
            ?.detectedMetadata?.thumbnailDataUrl;
          const detectedTitle = fileDescriptors.find((item) => item.detectedMetadata?.title)
            ?.detectedMetadata?.title;

          const finalizedProject = syncProject({
            ...baseProject,
            id: projectId,
            createdByName,
            title: input.title || detectedTitle || baseProject.title,
            description: input.description || detectedDescription || baseProject.description,
            coverImage: input.coverImage || detectedThumbnail || baseProject.coverImage,
            sourceUrl: input.sourceUrl || detectedSourceUrl,
            sourcePlatform:
              detectSourcePlatform(input.sourceUrl) ||
              detectedSourcePlatform ||
              detectSourcePlatform(detectedSourceUrl),
            files: storedFiles.map((entry) => ({
              ...entry,
              folderPath: getFolderPath(getProjectFileStorageRelativePath(entry.type, entry.originalPath || entry.name)),
              storedPath: createStoredPath(
                {
                  title: input.title,
                  creatorId: input.creatorId || undefined,
                  creatorFolderId: input.creatorFolderId || undefined,
                },
                creators,
                entry.originalPath || entry.name,
                entry.type,
              ),
            })),
            thumbnailFileId: storedFiles[0]?.id,
          });
          progressCallback?.(0.95);

          setProjects((current) => [finalizedProject, ...current]);
          progressCallback?.(1);
          pushDebugLog(
            `Project created with ${storedFiles.length} files: ${input.title}`,
          );

          return { projectId, added: storedFiles.length, skipped };
        } catch (error) {
          if (createdOnServer) {
            await fetch(`/api/projects/${projectId}`, {
              method: "DELETE",
            }).catch(() => undefined);
          }

          throw error;
        }
      },
      async updateProject(projectId, input) {
        const existingProject = projects.find((project) => project.id === projectId);
        if (!existingProject) {
          throw new Error("Projekt nicht gefunden.");
        }

        const nextProject = {
          ...existingProject,
          title: input.title,
          description: input.description,
          tags: normalizeTags(input.tags),
          categoryId: input.categoryId,
          creatorId: input.creatorId || undefined,
          creatorFolderId: input.creatorFolderId || undefined,
          license: input.license,
          author: input.author || existingProject.author,
          sourceUrl: input.sourceUrl ?? existingProject.sourceUrl,
          sourcePlatform: detectSourcePlatform(input.sourceUrl ?? existingProject.sourceUrl),
          coverImage: input.coverImage ?? existingProject.coverImage,
          coverLabel: input.title.slice(0, 8).toUpperCase(),
          lockedFields: input.lockedFields ?? existingProject.lockedFields,
          activity: input.activity ?? existingProject.activity,
          updatedAt: isoNow(),
        };

        const nextFiles =
          existingProject.files.length > 0
            ? rebuildProjectFileStorage(nextProject, creators)
            : existingProject.files;
        const projectMoveDescriptors =
          existingProject.files.length > 0
            ? existingProject.files.map((file, index) => ({
                fileId: file.id,
                oldStoredPath: file.storedPath,
                newStoredPath: nextFiles[index]?.storedPath || file.storedPath,
              }))
            : [];

        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error("Project could not be updated on the server.");
        }

        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? {
                  ...nextProject,
                  files: project.files,
                }
              : project,
          ),
        );
        if (projectMoveDescriptors.length > 0) {
          enqueueFilesystemMoveJob({
            label: `Projekt-Struktur aktualisieren: ${nextProject.title}`,
            projectId,
            projectTitle: nextProject.title,
            moves: projectMoveDescriptors,
            onComplete: () => {
              setProjects((current) =>
                current.map((project) =>
                  project.id === projectId ? { ...project, files: nextFiles } : project,
                ),
              );
            },
          });
        }
        pushDebugLog(`Project updated: ${projectId}`);
      },
      async deleteProject(projectId) {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("Project could not be deleted on the server.");
        }

        setProjects((current) =>
          current.filter((project) => project.id !== projectId),
        );
        setLists((current) =>
          current.map((list) => ({
            ...list,
            projectIds: list.projectIds.filter((id) => id !== projectId),
          })),
        );
        pushDebugLog(`Project deleted: ${projectId}`);
      },
      async updateProjectLocks(projectId, fields) {
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? { ...project, lockedFields: fields, updatedAt: isoNow() }
              : project,
          ),
        );
        pushDebugLog(`Project field locks updated: ${projectId}`);
      },
      updateProjectActivity(projectId, activity) {
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? syncProject({
                  ...project,
                  activity,
                })
              : project,
          ),
        );
        pushDebugLog(`Project activity updated: ${projectId}`);
      },
      async addFilesToProject(projectId, files, source = "upload", options) {
        const fileList = Array.from(files);
        const preparedUpload = await prepareProjectUploadFiles(fileList, source, options);
        const supportedFiles = preparedUpload.files;
        const skipped = preparedUpload.skipped;

        if (supportedFiles.length === 0) {
          pushDebugLog("No supported project files found in upload", "error");
          return { added: 0, skipped };
        }

        const project =
          projects.find((item) => item.id === projectId) ??
          ({
            title: "Project",
            creatorId: undefined,
            creatorFolderId: undefined,
          } satisfies Pick<Project, "title" | "creatorId" | "creatorFolderId">);
        const fileDescriptors = await Promise.all(
          supportedFiles.map(async (preparedFile) => {
            const file = preparedFile.file;
            const detectedMetadata =
              detectFileType(file.name) === "3MF" ? await extract3mfMetadata(file) : undefined;

            return {
              file,
              detectedMetadata,
              entry: fileToEntry(project, creators, file, preparedFile.source, {
                extractedFromZip: preparedFile.extractedFromArchive,
                notes: mergeFileNotes(
                  preparedFile.extractedFromArchive
                    ? `Aus Archiv ${preparedFile.extractedFromArchive} entpackt.`
                    : preparedFile.source === "zip"
                      ? "Aus ZIP entpackt."
                      : "Direkt importiert.",
                  detectedMetadata?.note,
                ),
              }, options),
            };
          }),
        );

        const storedFiles = await uploadFilesToFilesystem(
          projectId,
          fileDescriptors.map(({ entry, file }) => ({ entry, file })),
        );

        const detectedSourceUrl = fileDescriptors.find((item) => item.detectedMetadata?.sourceUrl)
          ?.detectedMetadata?.sourceUrl;
        const detectedSourcePlatform = detectedSourceUrl
          ? detectSourcePlatform(detectedSourceUrl)
          : undefined;

        setProjects((current) =>
          current.map((project) => {
            if (project.id !== projectId) return project;
            const projectEntries = storedFiles.map((entry) => ({
              ...entry,
              folderPath: getFolderPath(getProjectFileStorageRelativePath(entry.type, entry.originalPath || entry.name)),
              storedPath: createStoredPath(project, creators, entry.originalPath || entry.name, entry.type),
            }));

            return syncProject({
              ...project,
              files: [...projectEntries, ...project.files],
              thumbnailFileId: project.thumbnailFileId ?? projectEntries[0]?.id,
              sourceUrl: project.sourceUrl || detectedSourceUrl,
              sourcePlatform:
                project.sourcePlatform ||
                detectedSourcePlatform ||
                detectSourcePlatform(project.sourceUrl || detectedSourceUrl),
            });
          }),
        );

        pushDebugLog(`Added ${supportedFiles.length} files to project ${projectId}`);
        return { added: supportedFiles.length, skipped };
      },
      async addRemoteFilesToProject(projectId, files, source = "website") {
        return addRemoteFilesToProjectImpl(projectId, files, source);
      },
      async addZipToProject(projectId, zipFile, mode, options) {
        if (mode === "archive") {
          const archiveId = makeId("file");
          const project = projects.find((item) => item.id === projectId);
          if (!project) {
            throw new Error("Projekt nicht gefunden.");
          }

          const archiveEntry = fileToEntry(
            project,
            creators,
            new File([zipFile], zipFile.name, { type: zipFile.type }),
            "upload",
            {
              id: archiveId,
              type: detectFileType(zipFile.name),
              notes: isZipArchiveFile(zipFile.name)
                ? "ZIP-Archiv als Originaldatei gespeichert."
                : "Archiv als Originaldatei gespeichert.",
            },
          );

          const [storedArchiveEntry] = await uploadFilesToFilesystem(projectId, [
            { entry: archiveEntry, file: zipFile },
          ]);

          setProjects((current) =>
            current.map((currentProject) => {
              if (currentProject.id !== projectId) return currentProject;

              return syncProject({
                ...currentProject,
                files: [storedArchiveEntry, ...currentProject.files],
                thumbnailFileId: currentProject.thumbnailFileId ?? storedArchiveEntry.id,
              });
            }),
          );
          pushDebugLog(`Archive stored: ${zipFile.name}`);
          return { added: 1, skipped: 0 };
        }

        const extractedFiles: File[] = [];
        let skipped = 0;

        if (zipFile.size > MAX_BROWSER_ARCHIVE_IMPORT_BYTES) {
          throw new Error(
            `Archiv ist für den direkten Browser-Import zu groß (${humanFileSize(zipFile.size)}). Bitte lege es in den Server-Importordner und importiere es serverseitig.`,
          );
        }

        if (isZipArchiveFile(zipFile.name)) {
          options?.onArchiveStatus?.(
            buildArchiveImportStatus({
              name: zipFile.name,
              index: 1,
              total: 1,
              stage: "extracting",
            }),
          );
          const zip = await JSZip.loadAsync(zipFile);
          await Promise.all(
            Object.values(zip.files)
              .filter((entry) => !entry.dir)
              .map(async (entry) => {
                if (!isSupportedPrintFile(entry.name)) {
                  skipped += 1;
                  return;
                }

                const blob = await entry.async("blob");
                extractedFiles.push(
                  new File([blob], entry.name, {
                    type: blob.type,
                  }),
                );
              }),
          );
          options?.onArchiveStatus?.(
            buildArchiveImportStatus({
              name: zipFile.name,
              index: 1,
              total: 1,
              stage: "done",
              extractedCount: extractedFiles.length,
              skippedCount: skipped,
            }),
          );
        } else if (isSupportedArchiveFile(zipFile.name)) {
          options?.onArchiveStatus?.(
            buildArchiveImportStatus({
              name: zipFile.name,
              index: 1,
              total: 1,
              stage: "extracting",
            }),
          );
          const extracted = await extractArchiveWithServer(zipFile);
          extractedFiles.push(...extracted.files);
          skipped += extracted.skipped;
          options?.onArchiveStatus?.(
            buildArchiveImportStatus({
              name: zipFile.name,
              index: 1,
              total: 1,
              stage: "done",
              extractedCount: extracted.files.length,
              skippedCount: extracted.skipped,
            }),
          );
        } else {
          throw new Error("Nicht unterstütztes Archivformat.");
        }

        const project =
          projects.find((item) => item.id === projectId) ??
          ({
            title: "Project",
            creatorId: undefined,
            creatorFolderId: undefined,
          } satisfies Pick<Project, "title" | "creatorId" | "creatorFolderId">);
        const fileDescriptors = await Promise.all(
          extractedFiles.map(async (file) => {
            const detectedMetadata =
              detectFileType(file.name) === "3MF" ? await extract3mfMetadata(file) : undefined;

            return {
              file,
              detectedMetadata,
              entry: fileToEntry(project, creators, file, "zip", {
                extractedFromZip: zipFile.name,
                notes: mergeFileNotes(
                  `Aus ZIP ${zipFile.name} entpackt.`,
                  detectedMetadata?.note,
                ),
              }, options),
            };
          }),
        );

        const storedFiles = await uploadFilesToFilesystem(
          projectId,
          fileDescriptors.map(({ entry, file }) => ({ entry, file })),
        );

        const detectedSourceUrl = fileDescriptors.find((item) => item.detectedMetadata?.sourceUrl)
          ?.detectedMetadata?.sourceUrl;
        const detectedSourcePlatform = detectedSourceUrl
          ? detectSourcePlatform(detectedSourceUrl)
          : undefined;

        setProjects((current) =>
          current.map((project) => {
            if (project.id !== projectId) return project;
            const projectEntries = storedFiles.map((entry) => ({
              ...entry,
              folderPath: getFolderPath(getProjectFileStorageRelativePath(entry.type, entry.originalPath || entry.name)),
              storedPath: createStoredPath(project, creators, entry.originalPath || entry.name, entry.type),
            }));

            return syncProject({
              ...project,
              files: [...projectEntries, ...project.files],
              thumbnailFileId: project.thumbnailFileId ?? projectEntries[0]?.id,
              sourceUrl: project.sourceUrl || detectedSourceUrl,
              sourcePlatform:
                project.sourcePlatform ||
                detectedSourcePlatform ||
                detectSourcePlatform(project.sourceUrl || detectedSourceUrl),
            });
          }),
        );

        pushDebugLog(`Archive extracted: ${zipFile.name} (${extractedFiles.length} files)`);
        return { added: extractedFiles.length, skipped };
      },
      async importWebsiteMetadataToProject(projectId, metadata) {
        const authorName = normalizeAuthorToCreatorName(metadata.author);
        const creatorId = await ensureCreatorForAuthor(
          authorName,
          projects.find((project) => project.id === projectId)?.creatorId,
        );
        const categoryId = await ensureCategoryForWebsiteMetadata(metadata);

        setProjects((current) =>
          current.map((project) => {
            if (project.id !== projectId) return project;

            const locked = new Set(project.lockedFields);

            return {
              ...project,
              title: locked.has("title") ? project.title : metadata.title || project.title,
              description: locked.has("description")
                ? project.description
                : metadata.description || project.description,
              author: locked.has("author") ? project.author : authorName || metadata.author || project.author,
              license: locked.has("license") ? project.license : metadata.license || project.license,
              tags: locked.has("tags")
                ? project.tags
                : normalizeTags(metadata.tags ?? project.tags),
              sourceUrl: locked.has("sourceUrl")
                ? project.sourceUrl
                : metadata.sourceUrl || project.sourceUrl,
              sourcePlatform:
                metadata.sourcePlatform || detectSourcePlatform(metadata.sourceUrl || project.sourceUrl),
              coverImage: locked.has("coverImage")
                ? project.coverImage
                : metadata.images?.[0] || project.coverImage,
              coverLabel: (metadata.title || project.title).slice(0, 8).toUpperCase(),
              creatorId: project.creatorId || creatorId,
              categoryId: categoryId || project.categoryId || defaultCategories[0].id,
              updatedAt: isoNow(),
            };
          }),
        );
        pushDebugLog(`Website metadata imported into project ${projectId}`);
      },
      async createProjectFromWebsiteMetadata(metadata) {
        const authorName = normalizeAuthorToCreatorName(metadata.author);
        const creatorId = await ensureCreatorForAuthor(authorName);
        const categoryId = await ensureCategoryForWebsiteMetadata(metadata);

        const projectId = makeId("project");

        setProjects((current) => [
          {
            id: projectId,
            title: metadata.title || "Imported Project",
            description: metadata.description || "",
            coverLabel: (metadata.title || "IMPORT").slice(0, 8).toUpperCase(),
            coverGradient: projectGradient(current.length),
            tags: normalizeTags(metadata.tags ?? []),
            categoryId: categoryId || defaultCategories[0].id,
            creatorId,
            license: metadata.license || "Unknown",
            author: authorName || metadata.author || "Unknown",
            sourceUrl: metadata.sourceUrl,
            sourcePlatform: metadata.sourcePlatform || detectSourcePlatform(metadata.sourceUrl),
            coverImage: metadata.images?.[0],
            lockedFields: [],
            favorite: false,
            createdAt: isoNow(),
            updatedAt: isoNow(),
            files: [],
            activity: {
              isActive: false,
              printedFileIds: [],
              steps: [],
              shoppingList: [],
              links: [],
            },
          },
          ...current,
        ]);

        pushDebugLog(`Project created from website metadata: ${projectId}`);
        return projectId;
      },
      deleteFileFromProject(projectId, fileId) {
        const targetFile = projects
          .find((project) => project.id === projectId)
          ?.files.find((file) => file.id === fileId);
        if (targetFile) {
          if (settings.storageDriver === "filesystem") {
            void deleteFilesystemFiles([targetFile]).catch((error) => {
              pushDebugLog(
                error instanceof Error ? error.message : "Datei konnte nicht vom Dateisystem entfernt werden.",
                "error",
              );
            });
          }
        }
        setProjects((current) =>
          current.map((project) => {
            if (project.id !== projectId) return project;

            const nextFiles = project.files.filter((file) => file.id !== fileId);

            return syncProject({
              ...project,
              files: nextFiles,
              thumbnailFileId:
                project.thumbnailFileId === fileId
                  ? nextFiles[0]?.id
                  : project.thumbnailFileId,
            });
          }),
        );
        pushDebugLog(`File removed from project ${projectId}`);
      },
      setProjectThumbnail(projectId, fileId) {
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? { ...project, thumbnailFileId: fileId, updatedAt: isoNow() }
              : project,
          ),
        );
        pushDebugLog(`Project thumbnail changed: ${projectId}`);
      },
      buildSlicerLaunch(slicer, file) {
        const label =
          slicer === "prusa"
            ? "PrusaSlicer"
            : slicer === "orca"
              ? "OrcaSlicer"
              : "Bambu Studio";
        const filePath = toLocalFilesystemPath(settings, file);

        return `${label} "${filePath}"`;
      },
      buildDesktopOpenCommand(file, slicer) {
        const target = getDesktopTargetForSettings(
          settings,
          file,
          slicer ?? settings.preferredSlicer,
        );
        const filePath = toLocalFilesystemPath(settings, file);

        const labelMap: Record<DesktopOpenTarget, string> = {
          prusa: "PrusaSlicer",
          orca: "OrcaSlicer",
          bambu: "Bambu Studio",
          fusion360: "Fusion 360",
          freecad: "FreeCAD",
        };

        return {
          label: labelMap[target],
          command: `${labelMap[target]} "${filePath}"`,
        };
      },
      getDesktopOpenTarget(file, slicer) {
        return getDesktopTargetForSettings(settings, file, slicer ?? settings.preferredSlicer);
      },
      async openDesktopFile(file, slicer) {
        const target = getDesktopTargetForSettings(
          settings,
          file,
          slicer ?? settings.preferredSlicer,
        );
        const fileMimeType = file.mimeType || "application/octet-stream";

        const response = await fetch("/api/open-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file,
            fileMimeType,
            target,
            preferredSlicer: slicer ?? settings.preferredSlicer,
            storageMode: settings.storageMode,
            storagePath: settings.storagePath,
            slicerExePaths: settings.slicerExePaths,
            fusion360ExePath: settings.fusion360ExePath,
            freecadExePath: settings.freecadExePath,
          }),
        });

        const data = (await response.json()) as { error?: string; message?: string };
        if (!response.ok) {
          return {
            ok: false,
            message: data.error || "Desktop-Datei konnte nicht geöffnet werden.",
          };
        }

        return {
          ok: true,
          message: data.message || "Datei wurde im passenden Programm geöffnet.",
        };
      },
      async openDesktopFiles(files, slicer) {
        if (files.length === 0) return { ok: false, message: "Keine Dateien ausgewählt." };

        const target = getDesktopTargetForSettings(
          settings,
          files[0],
          slicer ?? settings.preferredSlicer,
        );

        const response = await fetch("/api/open-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files,
            filesData: undefined,
            target,
            preferredSlicer: slicer ?? settings.preferredSlicer,
            storageMode: settings.storageMode,
            storagePath: settings.storagePath,
            slicerExePaths: settings.slicerExePaths,
            fusion360ExePath: settings.fusion360ExePath,
            freecadExePath: settings.freecadExePath,
          }),
        });

        const data = (await response.json()) as { error?: string; message?: string };
        if (!response.ok) {
          return { ok: false, message: data.error || "Dateien konnten nicht geöffnet werden." };
        }
        return { ok: true, message: data.message || "Dateien wurden geöffnet." };
      },
      async getFileBlob(fileId) {
        const file = projects.flatMap((project) => project.files).find((entry) => entry.id === fileId);
        if (!file) return undefined;
        return readFilesystemFileBlob(file);
      },
      async getFileObjectUrl(fileId) {
        const file = projects.flatMap((project) => project.files).find((entry) => entry.id === fileId);
        if (!file) return "";
        const blob = await readFilesystemFileBlob(file);
        return URL.createObjectURL(blob);
      },
      async downloadProjectFile(file) {
        const blob = await readFilesystemFileBlob(file);
        if (!blob) {
          return { ok: false, message: "Datei konnte lokal nicht gefunden werden." };
        }

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
        return { ok: true, message: "Datei wurde heruntergeladen." };
      },
      setProjectFavorite(projectId, favorite) {
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId ? { ...project, favorite, updatedAt: isoNow() } : project,
          ),
        );
        setLists((current) =>
          current.map((list) =>
            list.id === "favorites"
              ? {
                  ...list,
                  projectIds: favorite
                    ? Array.from(new Set([...list.projectIds, projectId]))
                    : list.projectIds.filter((id) => id !== projectId),
                }
              : list,
          ),
        );
        pushDebugLog(`Project favorite changed: ${projectId}`);
      },
      async createList(name) {
        const response = await fetch("/api/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) {
          throw new Error("List could not be created on the server.");
        }
        const created = (await response.json()) as ProjectList;
        setLists((current) => [...current, created]);
        pushDebugLog(`List created: ${name}`);
      },
      async deleteList(listId) {
        if (listId === "favorites") return;
        const response = await fetch(`/api/lists/${listId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error("List could not be deleted on the server.");
        }
        setLists((current) => current.filter((list) => list.id !== listId));
        pushDebugLog(`List deleted: ${listId}`);
      },
      async addProjectToList(listId, projectId) {
        const response = await fetch(`/api/lists/${listId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        if (!response.ok) {
          throw new Error("Project could not be added to list on the server.");
        }

        setLists((current) =>
          current.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  projectIds: Array.from(new Set([...list.projectIds, projectId])),
                }
              : list,
          ),
        );
        pushDebugLog(`Project ${projectId} added to list ${listId}`);
      },
      async removeProjectFromList(listId, projectId) {
        const response = await fetch(
          `/api/lists/${listId}/entries?projectId=${encodeURIComponent(projectId)}`,
          {
            method: "DELETE",
          },
        );
        if (!response.ok) {
          throw new Error("Project could not be removed from list on the server.");
        }

        setLists((current) =>
          current.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  projectIds: list.projectIds.filter((id) => id !== projectId),
                }
              : list,
          ),
        );
        pushDebugLog(`Project ${projectId} removed from list ${listId}`);
      },
      resolveDuplicateGroup(groupKey, keepFileIds) {
        const removedFiles = projects
          .flatMap((project) => project.files)
          .filter((file) => `${file.originalName.toLowerCase()}::${file.sizeBytes}` === groupKey)
          .filter((file) => !keepFileIds.includes(file.id));

        if (removedFiles.length > 0) {
          if (settings.storageDriver === "filesystem") {
            void deleteFilesystemFiles(removedFiles).catch((error) => {
              pushDebugLog(
                error instanceof Error ? error.message : "Duplikatdateien konnten nicht entfernt werden.",
                "error",
              );
            });
          }
        }

        setProjects((current) =>
          current.map((project) => {
            const nextFiles = project.files.filter((file) => {
              const key = `${file.originalName.toLowerCase()}::${file.sizeBytes}`;
              if (key !== groupKey) {
                return true;
              }

              return keepFileIds.includes(file.id);
            });

            if (nextFiles.length === project.files.length) {
              return project;
            }

            return syncProject({
              ...project,
              files: nextFiles,
              thumbnailFileId: nextFiles.some((file) => file.id === project.thumbnailFileId)
                ? project.thumbnailFileId
                : nextFiles[0]?.id,
            });
          }),
        );
        pushDebugLog(`Duplicate group resolved: ${groupKey}`);
      },
      pushDebugLog,
      exportTransferBundle,
      importTransferBundle,
      refreshServerSnapshot,
      async resetApplication() {
        await clearAncillaryClientStorage();

        const response = await fetch("/api/system/reset", {
          method: "POST",
        });
        const payload = await parseJsonResponse<{ ok?: boolean; error?: string }>(
          response,
          "System konnte nicht zurückgesetzt werden.",
        );
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "System konnte nicht zurückgesetzt werden.");
        }
        pushDebugLog("Setup reset");
        window.location.href = "/setup";
      },
      hardResetApplication,
    }),
    [
      categories,
      clearAncillaryClientStorage,
      creators,
      debugLogs,
      duplicates,
      addRemoteFilesToProjectImpl,
      backgroundJobs,
      deleteFilesystemFiles,
      dismissBackgroundJob,
      enqueueFilesystemMoveJob,
      ensureCategoryForWebsiteMetadata,
      ensureCreatorForAuthor,
      exportTransferBundle,
      hardResetApplication,
      importTransferBundle,
      refreshServerSnapshot,
      lists,
      projects,
      pushDebugLog,
      readFilesystemFileBlob,
      ready,
      settings,
      stats,
      moveFilesystemFiles,
      uploadFilesToFilesystem,
    ],
  );

  return (
    <MakershelfContext.Provider value={value}>
      {children}
    </MakershelfContext.Provider>
  );
}

export function useMakershelf() {
  const context = useContext(MakershelfContext);

  if (!context) {
    throw new Error("useMakershelf must be used within MakershelfProvider");
  }

  return context;
}
