import { defaultSettings, type AppSettings } from "@/src/lib/makershelf-data";

type JsonRecord = Record<string, unknown>;

export function toSettingsRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as JsonRecord) } : {};
}

export function resolveWorkspaceSettings(value: unknown): AppSettings {
  return {
    ...defaultSettings,
    ...toSettingsRecord(value),
  } as AppSettings;
}

export function mergeWorkspaceSettings(value: unknown, input: Partial<AppSettings>) {
  return {
    ...toSettingsRecord(value),
    ...input,
  };
}
