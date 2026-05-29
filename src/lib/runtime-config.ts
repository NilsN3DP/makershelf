import {
  defaultSettings,
  type DataBackend,
  type StorageDriver,
} from "@/src/lib/makershelf-data";
import { isDemoModeEnabled } from "@/src/lib/demo-mode-core";

function readStringEnv(name: string) {
  if (typeof window !== "undefined") {
    const browserRuntime = (window as typeof window & {
      __MAKERSHELF_RUNTIME__?: Partial<Record<string, string>>;
    }).__MAKERSHELF_RUNTIME__;
    const browserValue = browserRuntime?.[name];
    if (browserValue?.trim()) {
      return browserValue.trim();
    }
  }

  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

function readNumberEnv(name: string, fallback: number) {
  const raw = readStringEnv(name);
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanEnv(name: string, fallback: boolean) {
  const raw = readStringEnv(name);
  if (!raw) {
    return fallback;
  }

  return raw === "1" || raw.toLowerCase() === "true";
}

export type RuntimeConfig = {
  appName: string;
  dataBackend: DataBackend;
  storageDriver: StorageDriver;
  pageSize: number;
  dashboardFeaturedCount: number;
  maxPreviewFileSizeMb: number;
  enableExperimentalWebsiteImport: boolean;
  demoMode: boolean;
  databaseUrl?: string;
  storageRoot?: string;
  importRoot?: string;
  prusaSlicerImportRoot?: string;
  licenseTier?: string;
  licenseKey?: string;
  licenseServerUrl?: string;
  licenseLastCheck?: string;
  instanceId?: string;
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    appName: readStringEnv("MAKERSHELF_APP_NAME") ?? defaultSettings.appName,
    dataBackend:
      (readStringEnv("MAKERSHELF_DATA_BACKEND") as DataBackend | undefined) ??
      defaultSettings.dataBackend,
    storageDriver:
      (readStringEnv("MAKERSHELF_STORAGE_DRIVER") as StorageDriver | undefined) ??
      defaultSettings.storageDriver,
    pageSize: readNumberEnv("MAKERSHELF_PAGE_SIZE", defaultSettings.pageSize),
    dashboardFeaturedCount: readNumberEnv(
      "MAKERSHELF_DASHBOARD_FEATURED_COUNT",
      defaultSettings.dashboardFeaturedCount,
    ),
    maxPreviewFileSizeMb: readNumberEnv(
      "MAKERSHELF_MAX_PREVIEW_FILE_SIZE_MB",
      defaultSettings.maxPreviewFileSizeMb,
    ),
    enableExperimentalWebsiteImport: readBooleanEnv(
      "MAKERSHELF_ENABLE_EXPERIMENTAL_WEBSITE_IMPORT",
      defaultSettings.enableExperimentalWebsiteImport,
    ),
    demoMode: isDemoModeEnabled(readStringEnv("MAKERSHELF_DEMO_MODE")),
    databaseUrl: readStringEnv("DATABASE_URL"),
    storageRoot: readStringEnv("MAKERSHELF_STORAGE_ROOT"),
    importRoot: readStringEnv("MAKERSHELF_IMPORT_ROOT"),
    prusaSlicerImportRoot: readStringEnv("MAKERSHELF_PRUSASLICER_IMPORT_ROOT"),
    licenseTier: readStringEnv("MAKERSHELF_LICENSE_TIER"),
    licenseKey: readStringEnv("MAKERSHELF_LICENSE_KEY"),
    licenseServerUrl: readStringEnv("MAKERSHELF_LICENSE_SERVER_URL"),
    licenseLastCheck: readStringEnv("MAKERSHELF_LICENSE_LAST_CHECK"),
    instanceId: readStringEnv("MAKERSHELF_INSTANCE_ID"),
  };
}
