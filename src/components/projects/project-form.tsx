"use client";

import JSZip from "jszip";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ProjectLoadingState, ProjectNotFoundState } from "@/src/components/projects/project-loading-state";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { extractPdfMetadata } from "@/src/lib/pdf-metadata";
import {
  ARCHIVE_FILE_ACCEPT,
  detectSourcePlatform,
  isSupportedArchiveFile,
  isSupportedPrintFile,
  isSupportedProjectFile,
  isZipArchiveFile,
  licenseOptions,
  type ProjectLockField,
} from "@/src/lib/makershelf-data";

const NEW_CATEGORY_VALUE = "__new_category__";
const lockOptions: Array<{ key: ProjectLockField; label: string }> = [
  { key: "title", label: "Titel sperren" },
  { key: "description", label: "Beschreibung sperren" },
  { key: "author", label: "Autor sperren" },
  { key: "license", label: "Lizenz sperren" },
  { key: "tags", label: "Tags sperren" },
  { key: "coverImage", label: "Cover sperren" },
  { key: "sourceUrl", label: "Original-Link sperren" },
];

type LinkDraft = {
  id: string;
  label: string;
  url: string;
};

type ZipProjectMetadata = {
  title?: string;
  description?: string;
  author?: string;
  license?: string;
  tags?: string[];
  sourceUrl?: string;
  coverImage?: string;
};

type ZipProjectAnalysis = {
  files: File[];
  skipped: number;
  sourceUrl: string;
  metadata: ZipProjectMetadata;
  infoFiles: string[];
  imageCount: number;
};

type WebsiteImportData = {
  error?: string;
  title?: string;
  description?: string;
  author?: string;
  category?: string;
  license?: string;
  tags?: string[];
  images?: string[];
  sourceUrl: string;
  sourcePlatform?: string;
  fileLinks?: string[];
  warnings?: string[];
};

const ZIP_INFO_FILE_PATTERN =
  /(^|\/)(makershelfinfo|project-info|project|metadata|model|info|manifest|readme|license)\.(json|txt|md|markdown)$/i;
const ZIP_IMAGE_PATTERN = /\.(png|jpe?g|webp)$/i;
const ZIP_URL_PATTERN = /https?:\/\/[^\s<>)\]"']+/gi;
const DIRECT_PRINT_FILE_ACCEPT = ".stl,.obj,.3mf,.step,.stp,.gcode,.amf,.ply,.f3d";
const PROJECT_FILE_ACCEPT = `${DIRECT_PRINT_FILE_ACCEPT},.pdf,${ARCHIVE_FILE_ACCEPT}`;

type ExtractedArchivePayload = {
  error?: string;
  files?: Array<{
    name: string;
    mimeType?: string;
    data: number[];
  }>;
  skipped?: number;
};

function makeDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Cover konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
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

  return {
    files: (payload?.files ?? []).map((file) => new File([new Uint8Array(file.data)], file.name, {
      type: file.mimeType || "application/octet-stream",
    })),
    skipped: payload?.skipped ?? 0,
  };
}

function normalizeZipUrl(candidate: string) {
  return candidate.replace(/[),.;]+$/g, "").trim();
}

function pickBestZipSourceUrl(urls: string[]) {
  const normalized = Array.from(new Set(urls.map(normalizeZipUrl).filter(Boolean)));

  return (
    normalized.find((url) => /printables\.com\/model\/\d+/i.test(url)) ||
    normalized.find((url) => /\/model\//i.test(url)) ||
    normalized[0] ||
    ""
  );
}

function readStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function normalizeZipLicense(value?: string) {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  const option =
    licenseOptions.find((item) => item.value.toLowerCase() === normalized) ||
    licenseOptions.find((item) => item.label.toLowerCase() === normalized) ||
    licenseOptions.find((item) => normalized.includes(item.value.toLowerCase()));

  return option?.value ?? value.trim();
}

function mergeZipMetadata(
  current: ZipProjectMetadata,
  incoming: ZipProjectMetadata,
): ZipProjectMetadata {
  const nextTags = Array.from(
    new Set([...(current.tags ?? []), ...(incoming.tags ?? [])].map((tag) => tag.trim()).filter(Boolean)),
  );

  return {
    title: current.title || incoming.title,
    description: current.description || incoming.description,
    author: current.author || incoming.author,
    license: current.license || incoming.license,
    sourceUrl: current.sourceUrl || incoming.sourceUrl,
    coverImage: current.coverImage || incoming.coverImage,
    tags: nextTags.length ? nextTags : current.tags ?? incoming.tags,
  };
}

function parseJsonZipMetadata(text: string): ZipProjectMetadata {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const sourceUrl =
      readStringValue(data.sourceUrl) ||
      readStringValue(data.url) ||
      readStringValue(data.link) ||
      readStringValue(data.modelUrl) ||
      readStringValue(data.printablesUrl);
    const author =
      readStringValue(data.author) ||
      readStringValue(data.creator) ||
      readStringValue(data.designer) ||
      readStringValue(data.user);

    return {
      title: readStringValue(data.title) || readStringValue(data.name) || readStringValue(data.modelName),
      description:
        readStringValue(data.description) ||
        readStringValue(data.summary) ||
        readStringValue(data.notes),
      author,
      license: normalizeZipLicense(readStringValue(data.license)),
      tags: readStringArray(data.tags) || readStringArray(data.categories) || readStringArray(data.keywords),
      sourceUrl,
    };
  } catch {
    return {};
  }
}

function parseTextZipMetadata(text: string): ZipProjectMetadata {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const metadata: ZipProjectMetadata = {};
  const descriptionLines: string[] = [];

  for (const line of lines.slice(0, 80)) {
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading?.[1] && !metadata.title) {
      metadata.title = heading[1].trim();
      continue;
    }

    const keyValue = line.match(/^([a-zäöüß _-]{3,24})\s*[:=-]\s*(.+)$/i);
    if (!keyValue) {
      const lineHasUrl = /https?:\/\/[^\s<>)\]"']+/i.test(line);
      if (!metadata.description && descriptionLines.length < 4 && !lineHasUrl) {
        descriptionLines.push(line);
      }
      continue;
    }

    const key = keyValue[1].toLowerCase().replace(/\s+/g, "");
    const value = keyValue[2].trim();

    if (["title", "titel", "name", "model", "modell"].includes(key)) metadata.title ||= value;
    if (["description", "beschreibung", "summary", "notes", "hinweise"].includes(key)) {
      metadata.description ||= value;
    }
    if (["author", "autor", "creator", "designer", "user"].includes(key)) metadata.author ||= value;
    if (["license", "lizenz"].includes(key)) metadata.license ||= normalizeZipLicense(value);
    if (["tags", "keywords", "kategorien", "categories"].includes(key)) metadata.tags ||= readStringArray(value);
    if (["url", "link", "source", "quelle", "sourceurl"].includes(key)) metadata.sourceUrl ||= value;
  }

  if (!metadata.description && descriptionLines.length) {
    metadata.description = descriptionLines.join("\n");
  }

  const urls = Array.from(text.matchAll(ZIP_URL_PATTERN), (match) => match[0]);
  metadata.sourceUrl ||= pickBestZipSourceUrl(urls);

  return metadata;
}

function titleFromFilename(value: string) {
  return value
    .replace(/\.[^.]+$/g, "")
    .replace(/^[0-9]+[-_\s]+/g, "")
    .replace(/[0-9a-f]{8}-[0-9a-f-]{20,}$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parsePdfFilenameMetadata(filename: string): ZipProjectMetadata {
  const baseName = filename.split(/[\\/]/).pop() ?? filename;
  const printablesExport = baseName.match(/^(\d+)[-_ ]+(.+?)\.(pdf)$/i);
  if (!printablesExport?.[1]) {
    return {};
  }

  return {
    title: printablesExport[2] ? titleFromFilename(printablesExport[2]) : undefined,
    sourceUrl: `https://www.printables.com/model/${printablesExport[1]}`,
  };
}

export function ProjectForm({
  mode,
  projectId,
}: {
  mode: "create" | "edit";
  projectId?: string;
}) {
  const router = useRouter();
  const {
    categories,
    creators,
    projects,
    ready,
    settings,
    createProject,
    createProjectWithFiles,
    updateProject,
    deleteProject,
    createCategory,
    createCreator,
    addRemoteFilesToProject,
    importWebsiteMetadataToProject,
  } = useMakershelf();
  const project = useMemo(
    () => projects.find((item) => item.id === projectId),
    [projectId, projects],
  );

  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [categoryId, setCategoryId] = useState(project?.categoryId ?? categories[0]?.id ?? "");
  const [license, setLicense] = useState(project?.license ?? "CC BY 4.0");
  const [tags, setTags] = useState(project?.tags.join(", ") ?? "");
  const [author, setAuthor] = useState(project?.author ?? settings.userName);
  const [sourceUrl, setSourceUrl] = useState(project?.sourceUrl ?? "");
  const [coverImage, setCoverImage] = useState(project?.coverImage ?? "");
  const [creatorId, setCreatorId] = useState(project?.creatorId ?? "");
  const [creatorFolderId, setCreatorFolderId] = useState(project?.creatorFolderId ?? "");
  const [isActive, setIsActive] = useState(project?.activity?.isActive ?? false);
  const [shoppingList, setShoppingList] = useState(project?.activity?.shoppingList.join("\n") ?? "");
  const [steps, setSteps] = useState(
    project?.activity?.steps.length
      ? project.activity.steps
      : [""],
  );
  const [links, setLinks] = useState<LinkDraft[]>(
    project?.activity?.links.length
      ? project.activity.links.map((item) => ({
          id: item.id,
          label: item.label,
          url: item.url,
        }))
      : [{ id: makeDraftId("link"), label: "", url: "" }],
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("📁");
  const [newCategoryColor, setNewCategoryColor] = useState(settings.primaryColor);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; description?: string }>({});
  const [linkImportStatus, setLinkImportStatus] = useState("");
  const [importedFileLinks, setImportedFileLinks] = useState<string[]>([]);
  const [initialZipFile, setInitialZipFile] = useState<File | null>(null);
  const [initialZipAnalysis, setInitialZipAnalysis] = useState<ZipProjectAnalysis | null>(null);
  const [initialZipMode, setInitialZipMode] = useState<"extract" | "archive">("extract");
  const [preserveInitialFolderStructure, setPreserveInitialFolderStructure] = useState(true);
  const [initialZipStatus, setInitialZipStatus] = useState("");
  const [initialPrintFiles, setInitialPrintFiles] = useState<File[]>([]);
  const [initialPrintFileStatus, setInitialPrintFileStatus] = useState("");
  const [lockedFields, setLockedFields] = useState<ProjectLockField[]>(
    project?.lockedFields ?? [],
  );

  const availableFolders = useMemo(
    () => creators.find((creator) => creator.id === creatorId)?.folders ?? [],
    [creatorId, creators],
  );
  const validSteps = useMemo(
    () => steps.map((item) => item.trim()).filter(Boolean),
    [steps],
  );
  const validShoppingItems = useMemo(
    () =>
      shoppingList
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [shoppingList],
  );

  if (mode === "edit" && !project && !ready) {
    return <ProjectLoadingState mode="form" />;
  }

  if (mode === "edit" && !project) {
    return <ProjectNotFoundState />;
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      setCategoryError("Bitte gib einen Kategorienamen ein.");
      return undefined;
    }

    setCreatingCategory(true);
    setCategoryError("");

    try {
      const createdId = await createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || "Benutzerdefinierte Kategorie",
        emoji: newCategoryEmoji.trim() || "📁",
        color: newCategoryColor,
      });
      setCategoryId(createdId);
      setNewCategoryName("");
      setNewCategoryDescription("");
      setNewCategoryEmoji("📁");
      setNewCategoryColor(settings.primaryColor);
      return createdId;
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Kategorie konnte nicht erstellt werden.",
      );
      return undefined;
    } finally {
      setCreatingCategory(false);
    }
  }

  async function ensureCategoryForImportedName(name?: string) {
    const trimmed = name?.trim();
    if (!trimmed) return "";

    const existing = categories.find(
      (category) => category.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      setCategoryId(existing.id);
      return existing.id;
    }

    try {
      const createdId = await createCategory({
        name: trimmed,
        description: "Automatisch aus dem Projektlink übernommen.",
        emoji: "🏷️",
        color: settings.primaryColor,
      });
      setCategoryId(createdId);
      setCategoryError("");
      return createdId;
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Kategorie konnte nicht automatisch angelegt werden.",
      );
      return "";
    }
  }

  async function ensureCreatorForImportedName(name?: string) {
    const trimmed = name?.replace(/^by\s+/i, "").trim();
    if (!trimmed) return "";

    const existing = creators.find(
      (creator) => creator.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      setCreatorId(existing.id);
      return existing.id;
    }

    try {
      const createdId = await createCreator({ name: trimmed, folders: [] });
      setCreatorId(createdId);
      setCreatorFolderId("");
      return createdId;
    } catch {
      return "";
    }
  }

  async function loadWebsiteMetadata(url: string) {
    const response = await fetch("/api/import-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });

    const data = (await response.json()) as WebsiteImportData;

    if (!response.ok) {
      throw new Error(data.error || "Metadaten konnten nicht geladen werden.");
    }

    return data;
  }

  async function applyWebsiteMetadataToForm(data: WebsiteImportData, fallbackUrl: string) {
    setTitle((current) => data.title || current);
    setDescription((current) => data.description || current);
    setAuthor((current) => data.author || current);
    setLicense((current) => data.license || current);
    setCoverImage((current) => data.images?.[0] || current);
    setSourceUrl(data.sourceUrl || fallbackUrl);
    setImportedFileLinks(data.fileLinks ?? []);
    if (data.category) {
      await ensureCategoryForImportedName(data.category);
    }
    if (data.author) {
      await ensureCreatorForImportedName(data.author);
    }
    const importedTags = Array.from(new Set([...(data.tags ?? []), data.category].filter(Boolean) as string[]));
    if (importedTags.length) {
      setTags(importedTags.join(", "));
    }
    if (data.title || data.description) {
      setFieldErrors((current) => ({
        ...current,
        title: data.title ? undefined : current.title,
        description: data.description ? undefined : current.description,
      }));
    }
  }

  function websiteMetadataStatus(data: WebsiteImportData) {
    const platform = data.sourcePlatform || detectSourcePlatform(data.sourceUrl);

    const categoryNote = data.category ? ` Kategorie: ${data.category}.` : "";

    return data.fileLinks?.length
      ? `Metadaten von ${platform || "der Website"} geladen.${categoryNote} ${data.fileLinks.length} direkte Datei-Links erkannt.`
      : data.warnings?.length
        ? `Metadaten von ${platform || "der Website"} geladen.${categoryNote} ${data.warnings.join(" ")}`
        : `Metadaten von ${platform || "der Website"} geladen.${categoryNote} Es wurden keine direkten Datei-Links erkannt, daher werden beim Erstellen nur die Infos übernommen.`;
  }

  async function handleImportFromLink() {
    if (!sourceUrl.trim()) {
      setLinkImportStatus("Bitte zuerst einen Projektlink einfügen.");
      return;
    }

    setLinkImportStatus("Link wird ausgewertet...");

    try {
      const data = await loadWebsiteMetadata(sourceUrl);
      await applyWebsiteMetadataToForm(data, sourceUrl);
      setLinkImportStatus(websiteMetadataStatus(data));
    } catch (error) {
      setLinkImportStatus(
        error instanceof Error ? error.message : "Metadaten konnten nicht geladen werden.",
      );
    }
  }

  async function importMetadataForProject(projectId: string, url: string) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return;
    }

    const response = await fetch("/api/import-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmedUrl }),
    });

    const data = (await response.json()) as {
      error?: string;
      title?: string;
      description?: string;
      author?: string;
      license?: string;
      tags?: string[];
      images?: string[];
      sourceUrl: string;
      sourcePlatform?: string;
      fileLinks?: string[];
      warnings?: string[];
    };

    if (!response.ok) {
      throw new Error(data.error || "Metadaten konnten nicht geladen werden.");
    }

    await importWebsiteMetadataToProject(projectId, data);
  }

  async function analyzeZipForCreate(zipFile: File): Promise<ZipProjectAnalysis> {
    const zip = await JSZip.loadAsync(zipFile);
    const extractedFiles: File[] = [];
    const metadataUrls: string[] = [];
    const infoFiles: string[] = [];
    let metadata: ZipProjectMetadata = {};
    let imageCount = 0;
    let skipped = 0;

    for (const entry of Object.values(zip.files).filter((item) => !item.dir)) {
      const lowerName = entry.name.toLowerCase();
      const blob = await entry.async("blob");
      const file = new File([blob], entry.name, {
        type: blob.type || "application/octet-stream",
      });

      if (lowerName.endsWith(".pdf")) {
        const filenameMetadata = parsePdfFilenameMetadata(entry.name);
        if (filenameMetadata.sourceUrl) {
          metadataUrls.push(filenameMetadata.sourceUrl);
        }
        metadata = mergeZipMetadata(metadata, filenameMetadata);

        const pdfMetadata = await extractPdfMetadata(
          new File([blob], entry.name, { type: blob.type || "application/pdf" }),
        );
        if (pdfMetadata?.sourceUrl) {
          metadataUrls.push(pdfMetadata.sourceUrl);
          metadata = mergeZipMetadata(metadata, { sourceUrl: pdfMetadata.sourceUrl });
        }
        if (pdfMetadata?.text) {
          metadata = mergeZipMetadata(metadata, parseTextZipMetadata(pdfMetadata.text));
        }
        infoFiles.push(entry.name);
        continue;
      }

      if (ZIP_INFO_FILE_PATTERN.test(entry.name)) {
        const text = await blob.text();
        const parsed =
          lowerName.endsWith(".json") || lowerName.endsWith(".makershelfinfo")
            ? parseJsonZipMetadata(text)
            : parseTextZipMetadata(text);
        if (parsed.sourceUrl) {
          metadataUrls.push(parsed.sourceUrl);
        }
        metadata = mergeZipMetadata(metadata, parsed);
        infoFiles.push(entry.name);
        continue;
      }

      if (ZIP_IMAGE_PATTERN.test(entry.name)) {
        imageCount += 1;
        if (!metadata.coverImage) {
          metadata = mergeZipMetadata(metadata, { coverImage: await readFileAsDataUrl(file) });
        }
      }

      if (!isSupportedPrintFile(entry.name)) {
        skipped += 1;
        continue;
      }

      extractedFiles.push(file);
    }

    const sourceUrl = pickBestZipSourceUrl([...(metadata.sourceUrl ? [metadata.sourceUrl] : []), ...metadataUrls]);

    return {
      files: extractedFiles,
      skipped,
      sourceUrl,
      metadata: { ...metadata, sourceUrl: metadata.sourceUrl || sourceUrl },
      infoFiles,
      imageCount,
    };
  }

  function applyZipMetadataToForm(metadata: ZipProjectMetadata) {
    if (metadata.title && !title.trim()) setTitle(metadata.title);
    if (metadata.description && !description.trim()) {
      setDescription(metadata.description);
      setFieldErrors((current) => ({ ...current, description: undefined }));
    }
    if (metadata.author && (!author.trim() || author === settings.userName)) setAuthor(metadata.author);
    if (metadata.license) setLicense(metadata.license);
    if (metadata.sourceUrl && !sourceUrl.trim()) setSourceUrl(metadata.sourceUrl);
    if (metadata.coverImage && !coverImage.trim()) setCoverImage(metadata.coverImage);
    if (metadata.tags?.length) {
      const mergedTags = Array.from(
        new Set([
          ...tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          ...metadata.tags.map((tag) => tag.trim()).filter(Boolean),
        ]),
      );
      setTags(mergedTags.join(", "));
    }
    if (metadata.title) {
      setFieldErrors((current) => ({ ...current, title: undefined }));
    }
  }

  async function handleInitialZipFileChange(file: File | null) {
    setInitialZipFile(file);
    setInitialZipAnalysis(null);

    if (!file) {
      setInitialZipStatus("");
      return;
    }

    if (!isZipArchiveFile(file.name)) {
      setInitialZipStatus(
        isSupportedArchiveFile(file.name)
          ? "Archiv bereit: wird beim Speichern serverseitig entpackt."
          : "Dieses Archivformat wird nicht unterstützt.",
      );
      return;
    }

    setInitialZipStatus("ZIP wird analysiert...");

    try {
      const analysis = await analyzeZipForCreate(file);
      setInitialZipAnalysis(analysis);
      applyZipMetadataToForm(analysis.metadata);
      const baseStatus = `ZIP bereit: ${analysis.files.length} Druckdatei(en), ${analysis.infoFiles.length} Info-Datei(en), ${analysis.imageCount} Bild(er) erkannt.`;

      if (analysis.sourceUrl) {
        setInitialZipStatus(`${baseStatus} Lade genaue Projektinfos vom Link...`);
        try {
          const websiteData = await loadWebsiteMetadata(analysis.sourceUrl);
          await applyWebsiteMetadataToForm(websiteData, analysis.sourceUrl);
          setInitialZipStatus(`${baseStatus} ${websiteMetadataStatus(websiteData)}`);
        } catch (metadataError) {
          setInitialZipStatus(
            metadataError instanceof Error
              ? `${baseStatus} Link erkannt (${analysis.sourceUrl}), Website-Daten konnten aber nicht geladen werden: ${metadataError.message}`
              : `${baseStatus} Link erkannt (${analysis.sourceUrl}), Website-Daten konnten aber nicht geladen werden.`,
          );
        }
        return;
      }

      setInitialZipStatus(baseStatus);
    } catch (error) {
      setInitialZipStatus(
        error instanceof Error ? `ZIP konnte nicht analysiert werden: ${error.message}` : "ZIP konnte nicht analysiert werden.",
      );
    }
  }

  function handleInitialPrintFilesChange(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    const supportedFiles = selectedFiles.filter((file) => isSupportedProjectFile(file.name));
    const skipped = selectedFiles.length - supportedFiles.length;

    setInitialPrintFiles(supportedFiles);
    setInitialPrintFileStatus(
      supportedFiles.length
        ? `${supportedFiles.length} Projektdatei(en) für das neue Projekt vorgemerkt${skipped ? `, ${skipped} Datei(en) übersprungen` : ""}. Archive werden beim Speichern entpackt.`
        : skipped
          ? "Keine unterstützten Projektdateien ausgewählt."
          : "",
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {mode === "create" ? "Neues Projekt" : (project?.title ?? "Projekt bearbeiten")}
          </h1>
          <p className="page-subtitle">
            {mode === "create" ? "Projekt anlegen und Dateien hinzufügen" : "Projektdaten aktualisieren"}
          </p>
        </div>
        <button type="button" onClick={() => router.back()} className="btn btn-secondary btn-sm">
          Abbrechen
        </button>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) {
            return;
          }

          setFormError("");
          setInitialZipStatus("");
          const nextFieldErrors: { title?: string; description?: string } = {};

          if (!title.trim()) {
            nextFieldErrors.title = "Bitte einen Projekttitel angeben.";
          }

          if (!description.trim()) {
            nextFieldErrors.description = "Bitte eine kurze Projektbeschreibung angeben.";
          }

          if (Object.keys(nextFieldErrors).length > 0) {
            setFieldErrors(nextFieldErrors);
            setFormError("Bitte prüfe die markierten Pflichtfelder, bevor du das Projekt speicherst.");
            return;
          }

          setFieldErrors({});
          setSaving(true);

          try {
            let resolvedCategoryId = categoryId;
            if (!resolvedCategoryId && newCategoryName.trim()) {
              const createdCategoryId = await handleCreateCategory();
              if (createdCategoryId) {
                resolvedCategoryId = createdCategoryId;
              }
            }
            if (!resolvedCategoryId) {
              setCategoryError("Bitte wähle eine Kategorie oder lege eine neue Kategorie mit Namen an.");
              setSaving(false);
              return;
            }

            let resolvedCreatorId = creatorId;
            if (!resolvedCreatorId && sourceUrl.trim() && author.trim()) {
              resolvedCreatorId = await ensureCreatorForImportedName(author);
            }

            const payload = {
              title,
              description,
              categoryId: resolvedCategoryId,
              license,
              tags: tags.split(","),
              author,
              sourceUrl,
              coverImage,
              creatorId: resolvedCreatorId,
              creatorFolderId,
              lockedFields,
              activity: {
                isActive,
                printedFileIds: project?.activity?.printedFileIds ?? [],
                steps: validSteps,
                shoppingList: validShoppingItems,
                links: links
                  .map((item) => ({
                    id: item.id,
                    label: item.label.trim(),
                    url: item.url.trim(),
                  }))
                  .filter((item) => item.label || item.url)
                  .map((item) => ({
                    ...item,
                    label: item.label || item.url,
                  })),
              },
            };

            if (mode === "create") {
              let nextId = "";
              let zipSkipped = 0;
              let metadataSourceUrl = "";
              let projectPayload = payload;
              const directFiles = [...initialPrintFiles];

              if (initialZipFile) {
                if (initialZipMode === "archive") {
                  setInitialZipStatus("Projekt wird erstellt und Archiv wird gespeichert...");
                  const analysis = isZipArchiveFile(initialZipFile.name)
                    ? initialZipAnalysis ?? (await analyzeZipForCreate(initialZipFile))
                    : undefined;
                  metadataSourceUrl = analysis?.sourceUrl ?? "";
                  projectPayload =
                    metadataSourceUrl && !payload.sourceUrl
                      ? { ...payload, sourceUrl: metadataSourceUrl }
                      : payload;
                  const result = await createProjectWithFiles(
                    projectPayload,
                    [...directFiles, initialZipFile],
                    "upload",
                    { preserveFolderStructure: preserveInitialFolderStructure, extractArchives: false },
                  );
                  nextId = result.projectId;
                  zipSkipped = result.skipped;
                } else {
                  setInitialZipStatus("Archiv wird entpackt und Projekt wird erstellt...");
                  const archiveExtracted = isZipArchiveFile(initialZipFile.name)
                    ? initialZipAnalysis ?? (await analyzeZipForCreate(initialZipFile))
                    : {
                        ...(await extractArchiveWithServer(initialZipFile)),
                        sourceUrl: "",
                        metadata: {},
                        infoFiles: [],
                        imageCount: 0,
                      };
                  if (archiveExtracted.files.length === 0) {
                    throw new Error(
                      "Das Archiv enthält keine unterstützten Druckdateien. Nutze ein Archiv mit STL, OBJ, 3MF, STEP, GCODE, AMF, PLY oder PDF.",
                    );
                  }

                  metadataSourceUrl = archiveExtracted.sourceUrl;
                  const filesForCreate = [...archiveExtracted.files, ...directFiles];
                  projectPayload =
                    metadataSourceUrl && !payload.sourceUrl
                      ? { ...payload, sourceUrl: metadataSourceUrl }
                      : payload;
                  const result = await createProjectWithFiles(
                    projectPayload,
                    filesForCreate,
                    "zip",
                    { preserveFolderStructure: preserveInitialFolderStructure },
                  );
                  nextId = result.projectId;
                  zipSkipped = result.skipped + archiveExtracted.skipped;
                }

                setInitialZipStatus(
                  zipSkipped > 0
                    ? `Archiv übernommen, ${zipSkipped} Datei(en) übersprungen.`
                    : "Archiv vollständig übernommen.",
                );
              } else if (directFiles.length > 0) {
                setInitialPrintFileStatus("Projekt wird mit Projektdateien erstellt. Archive werden entpackt...");
                  const result = await createProjectWithFiles(
                    projectPayload,
                    directFiles,
                    "upload",
                    {
                      preserveFolderStructure: preserveInitialFolderStructure,
                      onArchiveStatus: setInitialPrintFileStatus,
                    },
                  );
                nextId = result.projectId;
                setInitialPrintFileStatus(
                  result.skipped > 0
                    ? `${result.added} Projektdatei(en) übernommen, ${result.skipped} übersprungen.`
                    : `${result.added} Projektdatei(en) übernommen.`,
                );
              } else {
                nextId = await createProject(projectPayload);
              }

              const sourceUrlForMetadata = metadataSourceUrl || projectPayload.sourceUrl;
              if (sourceUrlForMetadata && metadataSourceUrl) {
                try {
                  setLinkImportStatus("PDF-Metadaten erkannt. Lade Projektinfos und Cover...");
                  await importMetadataForProject(nextId, sourceUrlForMetadata);
                  setLinkImportStatus("PDF-Metadaten übernommen.");
                } catch (error) {
                  setLinkImportStatus(
                    error instanceof Error
                      ? `PDF-Link erkannt, Metadaten konnten aber nicht übernommen werden: ${error.message}`
                      : "PDF-Link erkannt, Metadaten konnten aber nicht übernommen werden.",
                  );
                }
              }

              if (importedFileLinks.length > 0) {
                setLinkImportStatus("Projekt erstellt. Lade verknüpfte Dateien herunter...");
                const response = await fetch("/api/import-remote-files", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ urls: importedFileLinks }),
                });

                const remoteData = (await response.json()) as {
                  error?: string;
                  skipped?: number;
                  files?: Array<{
                    name: string;
                    mimeType?: string;
                    data: number[];
                    sourceUrl?: string;
                  }>;
                };

                if (response.ok && remoteData.files?.length) {
                  const result = await addRemoteFilesToProject(nextId, remoteData.files, "website");
                  setLinkImportStatus(
                    `${result.added} Dateien aus dem Link importiert, ${result.skipped + (remoteData.skipped ?? 0)} übersprungen.`,
                  );
                } else if (response.ok) {
                  setLinkImportStatus(
                    "Projekt erstellt. Es konnten keine direkt herunterladbaren Projektdateien aus dem Link übernommen werden.",
                  );
                } else if (remoteData.error) {
                  setLinkImportStatus(remoteData.error);
                }
              }
              router.push(`/project/${nextId}`);
              return;
            }

            await updateProject(projectId!, payload);
            router.push(`/project/${projectId}`);
          } catch (error) {
            setFormError(
              error instanceof Error ? error.message : "Projekt konnte nicht gespeichert werden.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        {/* ── Basic data ── */}
        <div className="panel" style={{ marginBottom: "1.25rem" }}>

        {/* ── File import (create only) ── */}
        {mode === "create" && (
          <div className="panel" style={{ marginBottom: "1.25rem", borderLeft: "3px solid var(--primary)" }}>
            <div className="panel-section" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--primary)", marginBottom: "4px" }}>Datei-Import</div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>Archiv oder Druckdateien auswählen</h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.5 }}>
                  ZIP-Archive werden sofort analysiert, RAR/7z/TAR/GZ beim Speichern serverseitig entpackt.
                  Alternativ einzelne STL, 3MF, STEP oder GCODE-Dateien anhängen.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <label className="btn btn-primary" style={{ cursor: "pointer" }}>
                  Archiv auswählen
                  <input type="file" accept={ARCHIVE_FILE_ACCEPT} style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0] ?? null; void handleInitialZipFileChange(file); event.target.value = ""; }} />
                </label>
                <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                  3D-Dateien
                  <input type="file" accept={PROJECT_FILE_ACCEPT} multiple style={{ display: "none" }} onChange={(event) => { handleInitialPrintFilesChange(event.target.files); event.target.value = ""; }} />
                </label>
                <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
                  Ordner
                  <input type="file" multiple style={{ display: "none" }} {...({ webkitdirectory: "true", directory: "true" } as Record<string, string>)} onChange={(event) => { handleInitialPrintFilesChange(event.target.files); event.target.value = ""; }} />
                </label>
              </div>
            </div>

            <div className="panel-section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", alignItems: "start" }}>
              <div style={{ background: "var(--panel-muted)", borderRadius: "8px", padding: "10px 14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-soft)", marginBottom: "4px" }}>Archiv</div>
                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)" }}>
                  {initialZipFile ? initialZipFile.name : "Nicht ausgewählt"}
                </div>
                {initialZipFile && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {(initialZipFile.size / 1024 / 1024).toFixed(1)} MB · {initialZipMode === "extract" ? "wird entpackt" : "als Archiv"}
                  </div>
                )}
              </div>
              <div style={{ background: "var(--panel-muted)", borderRadius: "8px", padding: "10px 14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-soft)", marginBottom: "4px" }}>Druckdateien</div>
                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)" }}>
                  {initialPrintFiles.length ? `${initialPrintFiles.length} Datei(en)` : "Nicht ausgewählt"}
                </div>
                {initialPrintFiles.length > 0 && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {initialPrintFiles.slice(0, 2).map(f => f.name).join(", ")}{initialPrintFiles.length > 2 ? ` +${initialPrintFiles.length - 2}` : ""}
                  </div>
                )}
              </div>
              <select className="input select" value={initialZipMode} onChange={(event) => setInitialZipMode(event.target.value as "extract" | "archive")} style={{ minWidth: "170px" }}>
                <option value="extract">Entpackt importieren</option>
                <option value="archive">Als Archiv speichern</option>
              </select>
            </div>

            <div className="panel-section" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", color: "var(--text-main)" }}>
                <input type="checkbox" checked={preserveInitialFolderStructure} onChange={(event) => setPreserveInitialFolderStructure(event.target.checked)} />
                Ordnerstruktur übernehmen
              </label>
              {initialZipFile && (
                <button type="button" onClick={() => { setInitialZipFile(null); setInitialZipAnalysis(null); setInitialZipStatus(""); }} className="btn btn-ghost btn-sm">
                  Archiv entfernen
                </button>
              )}
              {initialPrintFiles.length > 0 && (
                <button type="button" onClick={() => { setInitialPrintFiles([]); setInitialPrintFileStatus(""); }} className="btn btn-ghost btn-sm">
                  Dateien entfernen
                </button>
              )}
              {(initialZipStatus || initialPrintFileStatus) && (
                <span style={{ fontSize: "12.5px", color: "var(--text-muted)", flex: 1 }}>
                  {initialZipStatus || initialPrintFileStatus}
                </span>
              )}
            </div>
          </div>
        )}

          <div className="panel-section" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>Projektinfos</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>Titel, Beschreibung, Kategorie und Lizenz</p>
          </div>
          <div className="panel-section" style={{ display: "grid", gap: "16px" }}>
            <div>
              <label className="label">Titel *</label>
              <input
                className="input"
                value={title}
                onChange={(event) => { setTitle(event.target.value); setFieldErrors((current) => ({ ...current, title: undefined })); }}
                placeholder="z. B. Open Frame Filament Rack"
                aria-invalid={fieldErrors.title ? "true" : "false"}
                style={fieldErrors.title ? { borderColor: "var(--danger)" } : {}}
              />
              {fieldErrors.title && <p style={{ fontSize: "12px", color: "var(--danger)", marginTop: "4px" }}>{fieldErrors.title}</p>}
            </div>
            <div>
              <label className="label">Beschreibung *</label>
              <textarea
                className="input"
                value={description}
                onChange={(event) => { setDescription(event.target.value); setFieldErrors((current) => ({ ...current, description: undefined })); }}
                placeholder="Projektbeschreibung, Druckhinweise und Besonderheiten..."
                aria-invalid={fieldErrors.description ? "true" : "false"}
                style={{ minHeight: "100px", resize: "vertical", ...(fieldErrors.description ? { borderColor: "var(--danger)" } : {}) }}
              />
              {fieldErrors.description && <p style={{ fontSize: "12px", color: "var(--danger)", marginTop: "4px" }}>{fieldErrors.description}</p>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label">Kategorie</label>
                <select
                  className="input select"
                  value={categoryId || NEW_CATEGORY_VALUE}
                  onChange={(event) => {
                    setCategoryError("");
                    if (event.target.value === NEW_CATEGORY_VALUE) {
                      setCategoryId("");
                      return;
                    }
                    setCategoryId(event.target.value);
                  }}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.emoji} {category.name}</option>
                  ))}
                  <option value={NEW_CATEGORY_VALUE}>+ Neue Kategorie anlegen</option>
                </select>
              </div>
              <div>
                <label className="label">Lizenz</label>
                <select className="input select" value={license} onChange={(event) => setLicense(event.target.value)}>
                  {licenseOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label">Modell-Designer (Autor)</label>
                <input className="input" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="z. B. Printables-Username" />
              </div>
              <div>
                <label className="label">Tags</label>
                <input className="input" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="mechanisch, organizer, remix" />
              </div>
            </div>
          </div>
        </div>

        {!categoryId && (
          <div className="panel" style={{ marginBottom: "1.25rem", borderLeft: "3px solid var(--info)" }}>
            <div className="panel-section">
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 6px", color: "var(--text-main)" }}>Neue Kategorie anlegen</h3>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "0 0 12px" }}>
                Vergib einen Namen, sonst kann das Projekt keiner Kategorie zugeordnet werden.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <input className="input" value={newCategoryName} onChange={(event) => { setNewCategoryName(event.target.value); setCategoryError(""); }} placeholder="Kategoriename" />
                <input className="input" value={newCategoryDescription} onChange={(event) => setNewCategoryDescription(event.target.value)} placeholder="Beschreibung" />
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input className="input" value={newCategoryEmoji} onChange={(event) => setNewCategoryEmoji(event.target.value)} placeholder="📁" style={{ width: "80px" }} />
                <input type="color" className="input" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} style={{ width: "60px", padding: "4px", cursor: "pointer" }} />
                <button type="button" onClick={() => void handleCreateCategory()} className="btn btn-secondary" disabled={creatingCategory}>
                  {creatingCategory ? "Wird erstellt..." : "Kategorie erstellen"}
                </button>
              </div>
              {categoryError && <p style={{ fontSize: "12px", color: "var(--danger)", marginTop: "8px" }}>{categoryError}</p>}
            </div>
          </div>
        )}

        {/* ── Source & assignment ── */}
        <div className="panel" style={{ marginBottom: "1.25rem" }}>
          <div className="panel-section" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>Quelle & Zuordnung</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>Creator, Quell-URL, Cover und Status</p>
          </div>
          <div className="panel-section" style={{ display: "grid", gap: "16px" }}>
            {/* URL import row */}
            <div>
              <label className="label">Quell-URL</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input className="input" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://www.printables.com/model/..." style={{ flex: 1 }} />
                <button type="button" onClick={() => void handleImportFromLink()} className="btn btn-secondary" style={{ whiteSpace: "nowrap" }}>
                  Daten laden
                </button>
              </div>
              {linkImportStatus && <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>{linkImportStatus}</p>}
            </div>

            {/* Creator row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="label">Creator</label>
                <select className="input select" value={creatorId} onChange={(event) => { setCreatorId(event.target.value); setCreatorFolderId(""); }}>
                  <option value="">Nicht zuweisen</option>
                  {creators.map((creator) => (
                    <option key={creator.id} value={creator.id}>{creator.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Unterordner</label>
                <select className="input select" value={creatorFolderId} onChange={(event) => setCreatorFolderId(event.target.value)} disabled={!creatorId}>
                  <option value="">Nicht zuweisen</option>
                  {availableFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cover image */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "12px", alignItems: "start" }}>
              <div>
                <label className="label">Cover-Bild URL</label>
                <input className="input" value={coverImage} onChange={(event) => setCoverImage(event.target.value)} placeholder="https://..." style={{ marginBottom: "8px" }} />
                <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", display: "inline-flex" }}>
                  Bild hochladen
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const dataUrl = await readFileAsDataUrl(file); setCoverImage(dataUrl); event.target.value = ""; }} />
                </label>
              </div>
              <div style={{ background: "var(--panel-muted)", borderRadius: "8px", overflow: "hidden", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {coverImage ? (
                  <Image src={coverImage} alt="Cover" width={160} height={90} style={{ width: "100%", height: "100%", objectFit: "cover" }} unoptimized />
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--text-soft)", textAlign: "center", padding: "8px" }}>Kein Cover</span>
                )}
              </div>
            </div>

            {/* Active status */}
            <label className="toggle">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              <span className="toggle-track" />
              <span style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--text-main)" }}>Projekt aktiv (in Bearbeitung)</span>
            </label>
          </div>
        </div>

        {/* ── Organization ── */}
        <div className="panel" style={{ marginBottom: "1.25rem" }}>
          <div className="panel-section" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>Organisation</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>BOM, Projektschritte und Links (optional)</p>
          </div>
          <div className="panel-section" style={{ display: "grid", gap: "20px" }}>
            {/* BOM */}
            <div>
              <label className="label">BOM / Einkaufsliste</label>
              <textarea className="input" value={shoppingList} onChange={(event) => setShoppingList(event.target.value)} placeholder="Je Eintrag eine Zeile" style={{ minHeight: "80px", resize: "vertical" }} />
            </div>

            {/* Steps */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span className="label" style={{ margin: 0 }}>Projektschritte</span>
                <button type="button" onClick={() => setSteps((current) => [...current, ""])} className="btn btn-ghost btn-sm">+ Schritt</button>
              </div>
              <div style={{ display: "grid", gap: "6px" }}>
                {steps.map((step, index) => (
                  <div key={`step-${index}`} style={{ display: "flex", gap: "6px" }}>
                    <input className="input" value={step} onChange={(event) => setSteps((current) => current.map((item, i) => i === index ? event.target.value : item))} placeholder={`Schritt ${index + 1}`} style={{ flex: 1 }} />
                    <button type="button" onClick={() => setSteps((current) => current.length === 1 ? [""] : current.filter((_, i) => i !== index))} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span className="label" style={{ margin: 0 }}>Links</span>
                <button type="button" onClick={() => setLinks((current) => [...current, { id: makeDraftId("link"), label: "", url: "" }])} className="btn btn-ghost btn-sm">+ Link</button>
              </div>
              <div style={{ display: "grid", gap: "6px" }}>
                {links.map((link, index) => (
                  <div key={link.id} style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr auto", gap: "6px" }}>
                    <input className="input" value={link.label} onChange={(event) => setLinks((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="Titel" />
                    <input className="input" value={link.url} onChange={(event) => setLinks((current) => current.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} placeholder="https://..." />
                    <button type="button" onClick={() => setLinks((current) => current.length === 1 ? [{ id: makeDraftId("link"), label: "", url: "" }] : current.filter((_, i) => i !== index))} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Lock fields (edit only) ── */}
        {mode === "edit" && (
          <div className="panel" style={{ marginBottom: "1.25rem" }}>
            <div className="panel-section" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>Import-Schutz</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>Gesperrte Felder werden durch Website-Importe nicht überschrieben</p>
            </div>
            <div className="panel-section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {lockOptions.map((option) => {
                const checked = lockedFields.includes(option.key);
                return (
                  <label key={option.key} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "var(--panel-muted)", borderRadius: "8px", cursor: "pointer", fontSize: "13.5px", fontWeight: 500 }}>
                    <input type="checkbox" checked={checked} onChange={(event) => setLockedFields((current) => event.target.checked ? [...current, option.key] : current.filter((item) => item !== option.key))} />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {formError && (
          <div style={{ padding: "12px 16px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: "8px", fontSize: "13.5px", color: "var(--danger)", marginBottom: "1rem" }}>
            {formError}
          </div>
        )}

        {/* Sticky footer */}
        <div style={{ position: "sticky", bottom: "1rem", zIndex: 10, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", boxShadow: "var(--shadow-lg)", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary btn-lg" disabled={saving}>
            {saving
              ? (mode === "create" ? "Wird angelegt..." : "Speichert...")
              : (mode === "create" ? "Projekt anlegen" : "Änderungen speichern")}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-ghost">
            Abbrechen
          </button>
          {mode === "edit" && (
            <button
              type="button"
              onClick={async () => { await deleteProject(projectId!); router.push("/"); }}
              className="btn btn-danger"
              style={{ marginLeft: "auto" }}
            >
              Projekt löschen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
