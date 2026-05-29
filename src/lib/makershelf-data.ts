import {
  SUPPORTED_ARCHIVE_EXTENSIONS,
  getArchiveExtension,
  isSupportedArchiveFile,
  isZipArchiveFile,
} from "@/src/lib/archive-file-core";

export type Language = "de" | "en" | "fr" | "es" | "it" | "nl";

export type ThemeMode = "system" | "light" | "dark";

export type SlicerApp = "prusa" | "orca" | "bambu";

export type DesktopOpenTarget =
  | "prusa"
  | "orca"
  | "bambu"
  | "fusion360"
  | "freecad";

export type FileAssociationTarget = DesktopOpenTarget | "slicer" | "browser";

export type StorageMode = "browser" | "project-folders" | "custom-path";

export type DataBackend = "browser" | "sqlite" | "postgres";

export type StorageDriver = "indexeddb" | "filesystem" | "s3-compatible";

export type ProjectLockField =
  | "title"
  | "description"
  | "author"
  | "license"
  | "tags"
  | "coverImage"
  | "sourceUrl";

export type Category = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
};

export type CreatorFolder = {
  id: string;
  name: string;
};

export type Creator = {
  id: string;
  name: string;
  folders: CreatorFolder[];
};

export type FileType =
  | "F3D"
  | "STL"
  | "OBJ"
  | "3MF"
  | "STEP"
  | "GCODE"
  | "AMF"
  | "PLY"
  | "ZIP"
  | "ARCHIVE"
  | "PDF";

export type PrintFile = {
  id: string;
  name: string;
  originalName: string;
  type: FileType;
  sizeBytes: number;
  sizeLabel: string;
  mimeType?: string;
  originalPath?: string;
  folderPath?: string;
  storedPath: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  notes: string;
  source: "upload" | "zip" | "website" | "indexing";
  uploadedAt: string;
  extractedFromZip?: string;
};

export type ProjectLinkItem = {
  id: string;
  label: string;
  url: string;
};

export type ProjectActivity = {
  isActive: boolean;
  printedFileIds: string[];
  printCounts?: Record<string, number>;
  steps: string[];
  shoppingList: string[];
  links: ProjectLinkItem[];
};

export type Project = {
  id: string;
  title: string;
  description: string;
  coverLabel: string;
  coverGradient: string;
  tags: string[];
  categoryId: string;
  creatorId?: string;
  creatorFolderId?: string;
  license: string;
  author: string;
  sourceUrl?: string;
  coverImage?: string;
  sourcePlatform?: string;
  thumbnailFileId?: string;
  lockedFields: ProjectLockField[];
  favorite: boolean;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  files: PrintFile[];
  activity?: ProjectActivity;
};

export type ProjectList = {
  id: string;
  name: string;
  projectIds: string[];
};

export type AppSettings = {
  appName: string;
  userName: string;
  language: Language;
  themeMode: ThemeMode;
  multiUserEnabled: boolean;
  dataBackend: DataBackend;
  storageDriver: StorageDriver;
  primaryColor: string;
  secondaryColor: string;
  preferredSlicer: SlicerApp;
  storageMode: StorageMode;
  storagePath: string;
  windowsLibraryPath: string;
  debugMode: boolean;
  showBuyMeACoffeeButton: boolean;
  buyMeACoffeeUrl: string;
  slicerExePaths: Record<SlicerApp, string>;
  fusion360ExePath: string;
  freecadExePath: string;
  fileAssociations: Record<FileType, FileAssociationTarget>;
  pageSize: number;
  dashboardFeaturedCount: number;
  maxPreviewFileSizeMb: number;
  enableExperimentalWebsiteImport: boolean;
  prusaLinkEnabled: boolean;
  prusaLinkUrl: string;
  prusaLinkApiKey: string;
  filamentVaultEnabled: boolean;
  filamentOpenPrintTagEnabled: boolean;
  filamentTagBaseUrl: string;
  filamentLowThresholdGrams: number;
  filamentDefaultTareGrams: number;
  printerFarmEnabled: boolean;
  printToolsEnabled: boolean;
  laserEnabled: boolean;
  plotterEnabled: boolean;
  lightburnBridgeUrl: string;
  setupCompleted: boolean;
};

export type LicenseOption = {
  value: string;
  label: string;
  family: string;
};

export type SetupInput = {
  appName: string;
  userName: string;
  language: Language;
  themeMode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  preferredSlicer: SlicerApp;
  storageMode: StorageMode;
  storagePath: string;
  windowsLibraryPath: string;
  showBuyMeACoffeeButton: boolean;
  buyMeACoffeeUrl: string;
  filamentVaultEnabled?: boolean;
  categories: Array<Pick<Category, "name" | "emoji" | "description" | "color">>;
  creators: Array<{ name: string; folders: string[] }>;
};

export const SUPPORTED_PRINT_EXTENSIONS = [
  "f3d",
  "stl",
  "obj",
  "3mf",
  "step",
  "stp",
  "gcode",
  "amf",
  "ply",
  "pdf",
] as const;

export { SUPPORTED_ARCHIVE_EXTENSIONS, getArchiveExtension, isSupportedArchiveFile, isZipArchiveFile };

export const SUPPORTED_LASER_EXTENSIONS = ["svg", "ai", "pdf", "eps", "gcode", "dxf"] as const;
export const SUPPORTED_PLOTTER_EXTENSIONS = ["plt", "hpgl", "dxf", "svg"] as const;

export function isSupportedLaserFile(filename: string): boolean {
  const ext = getExtension(filename);
  return (SUPPORTED_LASER_EXTENSIONS as readonly string[]).includes(ext);
}

export function isSupportedPlotterFile(filename: string): boolean {
  const ext = getExtension(filename);
  return (SUPPORTED_PLOTTER_EXTENSIONS as readonly string[]).includes(ext);
}

/** Includes all 3D print files + laser/plotter files for indexing scans */
export function isSupportedIndexingFile(filename: string): boolean {
  return isSupportedProjectFile(filename) || isSupportedLaserFile(filename) || isSupportedPlotterFile(filename);
}

export const ARCHIVE_FILE_ACCEPT = SUPPORTED_ARCHIVE_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(",");

export const defaultSettings: AppSettings = {
  appName: "makershelf",
  userName: "",
  language: "en",
  themeMode: "system",
  multiUserEnabled: false,
  dataBackend: "postgres",
  storageDriver: "filesystem",
  primaryColor: "#f97316",
  secondaryColor: "#1e293b",
  preferredSlicer: "prusa",
  storageMode: "custom-path",
  storagePath: "Projects",
  windowsLibraryPath: "",
  debugMode: false,
  showBuyMeACoffeeButton: true,
  buyMeACoffeeUrl: "https://buymeacoffee.com/n3dp",
  slicerExePaths: {
    prusa: "",
    orca: "",
    bambu: "",
  },
  fusion360ExePath: "",
  freecadExePath: "",
  fileAssociations: {
    F3D: "fusion360",
    STL: "slicer",
    OBJ: "slicer",
    "3MF": "slicer",
    STEP: "freecad",
    GCODE: "slicer",
    AMF: "slicer",
    PLY: "fusion360",
    ZIP: "fusion360",
    ARCHIVE: "browser",
    PDF: "browser",
  },
  pageSize: 24,
  dashboardFeaturedCount: 6,
  maxPreviewFileSizeMb: 150,
  enableExperimentalWebsiteImport: true,
  prusaLinkEnabled: false,
  prusaLinkUrl: "",
  prusaLinkApiKey: "",
  filamentVaultEnabled: false,
  filamentOpenPrintTagEnabled: true,
  filamentTagBaseUrl: "",
  filamentLowThresholdGrams: 150,
  filamentDefaultTareGrams: 0,
  printerFarmEnabled: false,
  printToolsEnabled: false,
  laserEnabled: false,
  plotterEnabled: false,
  lightburnBridgeUrl: "",
  setupCompleted: false,
};

export const licenseOptions: LicenseOption[] = [
  { value: "CC0 1.0", label: "CC0 1.0", family: "Creative Commons" },
  { value: "CC BY 4.0", label: "CC BY 4.0", family: "Creative Commons" },
  { value: "CC BY-SA 4.0", label: "CC BY-SA 4.0", family: "Creative Commons" },
  { value: "CC BY-ND 4.0", label: "CC BY-ND 4.0", family: "Creative Commons" },
  { value: "CC BY-NC 4.0", label: "CC BY-NC 4.0", family: "Creative Commons" },
  { value: "CC BY-NC-SA 4.0", label: "CC BY-NC-SA 4.0", family: "Creative Commons" },
  { value: "CC BY-NC-ND 4.0", label: "CC BY-NC-ND 4.0", family: "Creative Commons" },
  { value: "GPL-3.0", label: "GPL-3.0", family: "Code license" },
  { value: "MIT", label: "MIT", family: "Code license" },
  { value: "Apache-2.0", label: "Apache-2.0", family: "Code license" },
  { value: "CERN-OHL-S-2.0", label: "CERN-OHL-S-2.0", family: "Hardware" },
  { value: "CERN-OHL-W-2.0", label: "CERN-OHL-W-2.0", family: "Hardware" },
  { value: "CERN-OHL-P-2.0", label: "CERN-OHL-P-2.0", family: "Hardware" },
  { value: "Personal Use", label: "Personal Use", family: "Restricted" },
  { value: "Non-Commercial", label: "Non-Commercial", family: "Restricted" },
  { value: "All Rights Reserved", label: "All Rights Reserved", family: "Restricted" },
  { value: "Commercial License", label: "Commercial License", family: "Commercial" },
  { value: "Standard Digital File License", label: "Standard Digital File License", family: "Platform" },
  { value: "Unknown", label: "Unknown", family: "Other" },
];

export const defaultCategories: Category[] = [
  {
    id: "functional",
    name: "Technische Teile",
    description: "Adapter, Halter, funktionale Drucke und Werkstattteile.",
    emoji: "🛠️",
    color: "#f97316",
  },
  {
    id: "cosplay",
    name: "Cosplay",
    description: "Helme, Masken, Requisiten und größere Wearables.",
    emoji: "🛡️",
    color: "#ef4444",
  },
  {
    id: "miniatures",
    name: "Miniaturen",
    description: "Figuren, Büsten und Diorama-Assets.",
    emoji: "🧙",
    color: "#8b5cf6",
  },
  {
    id: "organization",
    name: "Organisation",
    description: "Sortierhilfen, Einsätze und Lagerungssysteme.",
    emoji: "🗃️",
    color: "#10b981",
  },
];

export const defaultCreators: Creator[] = [
  {
    id: "author-x",
    name: "Author X",
    folders: [
      { id: "helmets", name: "Helme" },
      { id: "technical-parts", name: "Technische Teile" },
    ],
  },
  {
    id: "maker-lab",
    name: "Maker Lab",
    folders: [
      { id: "prototypes", name: "Prototypen" },
      { id: "mounts", name: "Halterungen" },
    ],
  },
];

export const defaultProjectLists: ProjectList[] = [
  {
    id: "favorites",
    name: "Favoriten",
    projectIds: ["warden-mask-prop"],
  },
];

export function humanFileSize(bytes: number) {
  if (!bytes) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function getBaseName(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

export function getFolderPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/");
}

export function isSupportedPrintFile(filename: string) {
  return SUPPORTED_PRINT_EXTENSIONS.includes(
    getExtension(filename) as (typeof SUPPORTED_PRINT_EXTENSIONS)[number],
  );
}

export function isSupportedProjectFile(filename: string) {
  return isSupportedPrintFile(filename) || isSupportedArchiveFile(filename);
}

export function detectFileType(filename: string): FileType {
  const extension = getExtension(filename).toUpperCase();

  switch (extension) {
    case "F3D":
    case "STL":
    case "OBJ":
    case "3MF":
    case "STEP":
    case "GCODE":
    case "AMF":
    case "PLY":
    case "ZIP":
      return extension;
    case "STP":
      return "STEP";
    case "PDF":
      return "PDF";
    default:
      if (isSupportedArchiveFile(filename)) {
        return isZipArchiveFile(filename) ? "ZIP" : "ARCHIVE";
      }
      return "STL";
  }
}

export function detectSourcePlatform(url?: string) {
  if (!url) {
    return "";
  }

  const normalized = url.toLowerCase();

  if (normalized.includes("printables.com")) return "Printables";
  if (normalized.includes("makerworld.com")) return "MakerWorld";
  if (normalized.includes("thingiverse.com")) return "Thingiverse";
  if (normalized.includes("thangs.com")) return "Thangs";
  if (normalized.includes("cults3d.com")) return "Cults3D";
  if (normalized.includes("patreon.com")) return "Patreon";
  if (normalized.includes("myminifactory.com")) return "MyMiniFactory";
  if (normalized.includes("github.com")) return "GitHub";

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Originalquelle";
  }
}

export function transliterateGerman(value: string) {
  return value
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function recommendDesktopApp(type: FileType, preferredSlicer: SlicerApp): DesktopOpenTarget {
  if (type === "STEP") {
    return "freecad";
  }

  if (type === "F3D" || type === "PLY") {
    return "fusion360";
  }

  if (type === "3MF" || type === "GCODE") {
    return preferredSlicer;
  }

  return "fusion360";
}

export function slugify(value: string) {
  return transliterateGerman(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeStoredPath(projectTitle: string, relativePath: string) {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  return `Projects/${slugify(projectTitle) || "untitled-project"}/${normalizedPath}`;
}

export const defaultProjects: Project[] = [
  {
    id: "hex-wall-lamp",
    title: "Hex Wall Lamp",
    description:
      "Modulare Sechseck-Wandlampe mit diffuser Front, Kabelkanal und montierbaren Segmenten.",
    coverLabel: "HEX",
    coverGradient:
      "[background:linear-gradient(135deg,var(--primary),color-mix(in_srgb,var(--primary)_60%,white),var(--secondary))]",
    tags: ["led", "wand", "modular"],
    categoryId: "functional",
    creatorId: "maker-lab",
    creatorFolderId: "prototypes",
    license: "CC BY-NC 4.0",
    author: "Nils",
    sourceUrl: "https://www.printables.com/model/example-hex-lamp",
    sourcePlatform: "Printables",
    coverImage: "",
    lockedFields: [],
    favorite: false,
    createdAt: "2026-04-12T20:30:00.000Z",
    updatedAt: "2026-04-13T00:48:00.000Z",
    files: [
      {
        id: "file-hex-shell",
        name: "hex-shell-v3.stl",
        originalName: "hex-shell-v3.stl",
        type: "STL",
        sizeBytes: 15518924,
        sizeLabel: humanFileSize(15518924),
        originalPath: "hex-shell-v3.stl",
        folderPath: "",
        storedPath: makeStoredPath("Hex Wall Lamp", "hex-shell-v3.stl"),
        notes: "Außenhülle mit sauberem Kabelkanal für LED-Strip.",
        source: "website",
        uploadedAt: "2026-04-13T00:10:00.000Z",
      },
      {
        id: "file-hex-diffuser",
        name: "diffuser-panel.3mf",
        originalName: "diffuser-panel.3mf",
        type: "3MF",
        sizeBytes: 4301821,
        sizeLabel: humanFileSize(4301821),
        originalPath: "diffuser-panel.3mf",
        folderPath: "",
        storedPath: makeStoredPath("Hex Wall Lamp", "diffuser-panel.3mf"),
        notes: "Frontpanel für matte Lichtverteilung.",
        source: "website",
        uploadedAt: "2026-04-13T00:20:00.000Z",
      },
    ],
    thumbnailFileId: "file-hex-shell",
  },
  {
    id: "warden-mask-prop",
    title: "Warden Mask Prop",
    description:
      "Display-Maske mit segmentierten Drucken, Passstiften und Test-GCode für den Visor.",
    coverLabel: "MASK",
    coverGradient:
      "[background:linear-gradient(135deg,var(--secondary),color-mix(in_srgb,var(--secondary)_70%,white),var(--primary))]",
    tags: ["cosplay", "helm", "wearable"],
    categoryId: "cosplay",
    creatorId: "author-x",
    creatorFolderId: "helmets",
    license: "Personal Use",
    author: "Author X",
    sourcePlatform: "",
    lockedFields: [],
    favorite: true,
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-12T18:30:00.000Z",
    files: [
      {
        id: "file-mask-front",
        name: "mask-front-left.stl",
        originalName: "mask-front-left.stl",
        type: "STL",
        sizeBytes: 28400000,
        sizeLabel: humanFileSize(28400000),
        originalPath: "Parts/mask-front-left.stl",
        folderPath: "Parts",
        storedPath: makeStoredPath("Warden Mask Prop", "Parts/mask-front-left.stl"),
        notes: "Segment links vorne, aufgeteilt für 220x220 Bett.",
        source: "upload",
        uploadedAt: "2026-04-12T18:00:00.000Z",
      },
      {
        id: "file-mask-back",
        name: "mask-back-right.stl",
        originalName: "mask-back-right.stl",
        type: "STL",
        sizeBytes: 24300000,
        sizeLabel: humanFileSize(24300000),
        originalPath: "Parts/mask-back-right.stl",
        folderPath: "Parts",
        storedPath: makeStoredPath("Warden Mask Prop", "Parts/mask-back-right.stl"),
        notes: "Segment hinten rechts mit Locator-Pins.",
        source: "upload",
        uploadedAt: "2026-04-12T18:10:00.000Z",
      },
      {
        id: "file-mask-gcode",
        name: "visor-test.gcode",
        originalName: "visor-test.gcode",
        type: "GCODE",
        sizeBytes: 8800000,
        sizeLabel: humanFileSize(8800000),
        originalPath: "Slicer/visor-test.gcode",
        folderPath: "Slicer",
        storedPath: makeStoredPath("Warden Mask Prop", "Slicer/visor-test.gcode"),
        notes: "Slicer-Export mit 0.2mm Layerhöhe.",
        source: "upload",
        uploadedAt: "2026-04-12T18:20:00.000Z",
      },
    ],
    thumbnailFileId: "file-mask-front",
  },
];
