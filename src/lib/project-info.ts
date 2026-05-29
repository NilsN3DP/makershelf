import {
  transliterateGerman,
  type AppSettings,
  type Category,
  type Creator,
  type PrintFile,
  type Project,
} from "@/src/lib/makershelf-data";

export const MAKERSHELFINFO_FILE_NAME = "MakershelfInfo.json";

function sanitizeStorageSegment(value: string | undefined, fallback: string) {
  const cleaned = transliterateGerman(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\.+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

export function resolveCreatorStorageSegments(
  creators: Creator[],
  creatorId?: string,
  creatorFolderId?: string,
) {
  if (!creatorId) {
    return ["_Ohne-Creator"];
  }

  const creator = creators.find((entry) => entry.id === creatorId);
  const creatorSegment = sanitizeStorageSegment(creator?.name, "Unbekannter-Creator");
  const creatorFolder = creator?.folders.find((entry) => entry.id === creatorFolderId);
  const folderSegment = sanitizeStorageSegment(creatorFolder?.name, "_Ungeordnet");

  return ["Creators", creatorSegment, folderSegment];
}

export function buildProjectStorageBasePath(
  project: Pick<Project, "title" | "creatorId" | "creatorFolderId">,
  creators: Creator[],
) {
  const projectSegment = sanitizeStorageSegment(project.title, "Unbenanntes-Projekt");
  return [
    "Projects",
    ...resolveCreatorStorageSegments(creators, project.creatorId, project.creatorFolderId),
    projectSegment,
  ].join("/");
}

function findCategory(categories: Category[], categoryId: string) {
  return categories.find((category) => category.id === categoryId);
}

function findCreator(creators: Creator[], creatorId?: string, folderId?: string) {
  const creator = creators.find((entry) => entry.id === creatorId);
  const folder = creator?.folders.find((entry) => entry.id === folderId);

  return {
    id: creator?.id ?? "",
    name: creator?.name ?? "",
    folderId: folder?.id ?? "",
    folderName: folder?.name ?? "",
  };
}

function sortFiles(files: PrintFile[]) {
  return [...files].sort((left, right) =>
    (left.originalPath || left.name).localeCompare(right.originalPath || right.name),
  );
}

export function buildProjectInfoData(input: {
  project: Project;
  categories: Category[];
  creators: Creator[];
  settings?: Pick<AppSettings, "appName" | "storageMode" | "storagePath">;
}) {
  const { project, categories, creators, settings } = input;
  const category = findCategory(categories, project.categoryId);
  const creator = findCreator(creators, project.creatorId, project.creatorFolderId);
  const projectFolder = buildProjectStorageBasePath(project, creators);

  return {
    format: "makershelf MakershelfInfo",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: {
      name: settings?.appName ?? "makershelf",
    },
    storage: {
      projectFolder,
      storageMode: settings?.storageMode ?? "",
      storagePath: settings?.storagePath ?? "",
    },
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      author: project.author,
      license: project.license,
      sourceUrl: project.sourceUrl ?? "",
      sourcePlatform: project.sourcePlatform ?? "",
      coverImage: project.coverImage ?? "",
      favorite: project.favorite,
      tags: project.tags,
      category: {
        id: category?.id ?? project.categoryId,
        name: category?.name ?? "",
        emoji: category?.emoji ?? "",
        color: category?.color ?? "",
      },
      creator,
      createdByName: project.createdByName ?? "",
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      thumbnailFileId: project.thumbnailFileId ?? "",
    },
    activity: {
      isActive: project.activity?.isActive ?? false,
      printedFileIds: project.activity?.printedFileIds ?? [],
      steps: project.activity?.steps ?? [],
      shoppingList: project.activity?.shoppingList ?? [],
      links: project.activity?.links ?? [],
    },
    files: sortFiles(project.files).map((file) => ({
      id: file.id,
      name: file.name,
      originalName: file.originalName,
      type: file.type,
      sizeBytes: file.sizeBytes,
      sizeLabel: file.sizeLabel,
      mimeType: file.mimeType ?? "",
      originalPath: file.originalPath ?? "",
      folderPath: file.folderPath ?? "",
      storedPath: file.storedPath,
      notes: file.notes,
      source: file.source,
      uploadedAt: file.uploadedAt,
      extractedFromZip: file.extractedFromZip ?? "",
    })),
  };
}

export function buildProjectInfoJson(input: Parameters<typeof buildProjectInfoData>[0]) {
  return `${JSON.stringify(buildProjectInfoData(input), null, 2)}\n`;
}
