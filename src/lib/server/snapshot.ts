import type {
  AppSettings,
  Category,
  Creator,
  PrintFile,
  Project,
  ProjectActivity,
  ProjectList,
} from "@/src/lib/makershelf-data";
import {
  defaultSettings,
  humanFileSize,
  type FileType,
} from "@/src/lib/makershelf-data";
import type { MakershelfSnapshot } from "@/src/lib/repositories/makershelf-repository";

type WorkspaceWithRelations = Awaited<ReturnType<typeof import("@/src/lib/server/queries").getWorkspaceSnapshotData>>;

function toFileType(value: string): FileType {
  if (["STL", "OBJ", "3MF", "STEP", "GCODE", "AMF", "PLY", "ZIP", "ARCHIVE", "PDF"].includes(value)) {
    return value as FileType;
  }

  return "STL";
}

function mapCategories(data: NonNullable<WorkspaceWithRelations>): Category[] {
  return data.categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    emoji: category.emoji,
    color: category.color,
  }));
}

function mapCreators(data: NonNullable<WorkspaceWithRelations>): Creator[] {
  return data.creators.map((creator) => ({
    id: creator.id,
    name: creator.name,
    folders: creator.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
  }));
}

function mapLists(data: NonNullable<WorkspaceWithRelations>): ProjectList[] {
  return data.lists.map((list) => ({
    id: list.id,
    name: list.name,
    projectIds: list.entries.map((entry) => entry.projectId),
  }));
}

function mapActivity(project: NonNullable<WorkspaceWithRelations>["projects"][number]): ProjectActivity {
  return {
    isActive: project.status === "ACTIVE" || project.status === "PRINTING",
    printedFileIds: project.printedFiles.filter((item) => item.printed).map((item) => item.projectFileId),
    steps: project.steps
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((step) => step.label),
    shoppingList: project.shoppingItems
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => item.quantity ? `${item.quantity} ${item.label}` : item.label),
    links: project.links
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((link) => ({
        id: link.id,
        label: link.label,
        url: link.url,
      })),
  };
}

function mapFiles(project: NonNullable<WorkspaceWithRelations>["projects"][number]): PrintFile[] {
  return project.files.map((file) => ({
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    type: toFileType(file.type),
    sizeBytes: Number(file.sizeBytes),
    sizeLabel: humanFileSize(Number(file.sizeBytes)),
    mimeType: file.mimeType ?? undefined,
    originalPath: file.originalPath ?? undefined,
    folderPath: file.folderPath ?? undefined,
    storedPath: file.storedPath,
    notes: file.notes,
    source: file.source.toLowerCase() as PrintFile["source"],
    uploadedAt: file.uploadedAt.toISOString(),
    extractedFromZip: file.extractedFromZip ?? undefined,
  }));
}

function mapProjects(data: NonNullable<WorkspaceWithRelations>): Project[] {
  return data.projects.map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    coverLabel: project.coverLabel ?? project.title.slice(0, 8).toUpperCase(),
    coverGradient: project.coverGradient ?? "",
    tags: Array.isArray(project.tags) ? project.tags.map(String) : [],
    categoryId: project.categoryId ?? "",
    creatorId: project.creatorId ?? undefined,
    creatorFolderId: project.creatorFolderId ?? undefined,
    license: project.license,
    author: project.author,
    sourceUrl: project.sourceUrl ?? undefined,
    sourcePlatform: project.sourcePlatform ?? undefined,
    coverImage: project.coverImage ?? undefined,
    thumbnailFileId: project.thumbnailFileId ?? undefined,
    lockedFields: Array.isArray(project.lockedFields)
      ? project.lockedFields.map(String) as Project["lockedFields"]
      : [],
    favorite: project.favorite,
    createdByName:
      project.metadataJson &&
      typeof project.metadataJson === "object" &&
      "createdByName" in project.metadataJson &&
      typeof project.metadataJson.createdByName === "string"
        ? project.metadataJson.createdByName
        : undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    files: mapFiles(project),
    activity: mapActivity(project),
  }));
}

function mapSettings(data: NonNullable<WorkspaceWithRelations>): AppSettings {
  const settingsJson =
    data.settingsJson && typeof data.settingsJson === "object"
      ? (data.settingsJson as Record<string, unknown>)
      : {};
  const multiUserEnabled =
    typeof settingsJson.multiUserEnabled === "boolean"
      ? settingsJson.multiUserEnabled
      : defaultSettings.multiUserEnabled;

  return {
    ...defaultSettings,
    ...settingsJson,
    appName: data.name,
    language: data.language as AppSettings["language"],
    themeMode: data.themeMode as AppSettings["themeMode"],
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor,
    multiUserEnabled,
    dataBackend: data.dataBackend as AppSettings["dataBackend"],
    storageDriver: data.storageDriver.toLowerCase().replace("_", "-") as AppSettings["storageDriver"],
    setupCompleted: true,
  };
}

export function mapWorkspaceToSnapshot(data: NonNullable<WorkspaceWithRelations>): MakershelfSnapshot {
  return {
    settings: mapSettings(data),
    categories: mapCategories(data),
    creators: mapCreators(data),
    projects: mapProjects(data),
    lists: mapLists(data),
  };
}
