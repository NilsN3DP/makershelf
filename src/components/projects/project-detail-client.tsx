"use client";

import JSZip from "jszip";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { BridgeSetupModal } from "@/src/components/layout/bridge-setup-modal";
import { FileCard } from "@/src/components/projects/file-card";
import { LicenseSummary } from "@/src/components/projects/license-summary";
import { ProjectLoadingState, ProjectNotFoundState } from "@/src/components/projects/project-loading-state";
import { ProjectThumbnail } from "@/src/components/projects/project-thumbnail";
import { ThreeDViewer } from "@/src/components/projects/three-d-viewer";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { ARCHIVE_FILE_ACCEPT, detectSourcePlatform, isSupportedArchiveFile, type PrintFile } from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";
import { collectTreeFolderPaths } from "@/src/lib/file-tree-collapse-core";
import { pickSelectedZipFiles } from "@/src/lib/project-zip-export-core";

const uploadAccept = `.stl,.obj,.3mf,.step,.stp,.gcode,.amf,.ply,.pdf,${ARCHIVE_FILE_ACCEPT}`;
const previewFileTypes = new Set(["STL", "OBJ", "3MF", "GCODE", "STEP"]);
const BRIDGE_KEY = "makershelf-bridge-installed-v2";

type ProjectDetailTab = "files" | "pdfs" | "overview" | "printed" | "bom" | "steps" | "links";
type GuestLink = {
  id: string;
  label: string;
  url: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
type FileTreeNode = {
  name: string;
  path: string;
  files: PrintFile[];
  children: FileTreeNode[];
};

function normalizeFolderPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function buildFileTree(files: PrintFile[]) {
  const root: FileTreeNode = { name: "", path: "", files: [], children: [] };
  const nodeMap = new Map<string, FileTreeNode>([["", root]]);

  function ensureNode(path: string) {
    const normalized = normalizeFolderPath(path);
    const existing = nodeMap.get(normalized);
    if (existing) return existing;

    const parts = normalized.split("/").filter(Boolean);
    const parentPath = parts.slice(0, -1).join("/");
    const parent = ensureNode(parentPath);
    const node: FileTreeNode = {
      name: parts.at(-1) ?? normalized,
      path: normalized,
      files: [],
      children: [],
    };
    parent.children.push(node);
    nodeMap.set(normalized, node);
    return node;
  }

  for (const file of files) {
    const folderPath = normalizeFolderPath(file.folderPath || "");
    ensureNode(folderPath).files.push(file);
  }

  function sortNode(node: FileTreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortNode);
  }

  sortNode(root);
  return root;
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const {
    categories,
    creators,
    lists,
    projects,
    addFilesToProject,
    addZipToProject,
    addRemoteFilesToProject,
    importWebsiteMetadataToProject,
    deleteFileFromProject,
    setProjectThumbnail,
    updateProject,
    updateProjectLocks,
    updateProjectActivity,
    addProjectToList,
    removeProjectFromList,
    createList,
    getFileBlob,
    setProjectFavorite,
    openDesktopFiles,
    ready,
    settings,
  } = useMakershelf();
  const [metadataStatus, setMetadataStatus] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [zipMode, setZipMode] = useState<"extract" | "archive">("extract");
  const [preserveFolderStructure, setPreserveFolderStructure] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [sourceUrlDraft, setSourceUrlDraft] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>("files");
  const [stepDraft, setStepDraft] = useState("");
  const [shoppingDraft, setShoppingDraft] = useState("");
  const [linkLabelDraft, setLinkLabelDraft] = useState("");
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [showListMenu, setShowListMenu] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [guestLinks, setGuestLinks] = useState<GuestLink[]>([]);
  const [guestLinkStatus, setGuestLinkStatus] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [slicerMultiStatus, setSlicerMultiStatus] = useState("");
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [pendingBridgeFiles, setPendingBridgeFiles] = useState<PrintFile[]>([]);
  const [filesSort, setFilesSort] = useState<"folder" | "name" | "type" | "size">("folder");
  const [collapsedFileFolders, setCollapsedFileFolders] = useState<Set<string>>(new Set());
  const [collapsedPrintedFolders, setCollapsedPrintedFolders] = useState<Set<string>>(new Set());

  const project = useMemo(
    () => projects.find((item) => item.id === projectId),
    [projectId, projects],
  );

  const category = categories.find((item) => item.id === project?.categoryId);
  const creator = creators.find((item) => item.id === project?.creatorId);
  const creatorFolder = creator?.folders.find(
    (item) => item.id === project?.creatorFolderId,
  );
  const selectedFile =
    project?.files.find((file) => file.id === selectedFileId) ??
    project?.files.find((file) => file.id === project.thumbnailFileId) ??
    project?.files.find((file) => previewFileTypes.has(file.type)) ??
    project?.files[0];
  const thumbnailFile = project?.files.find(
    (file) => file.id === project.thumbnailFileId,
  );
  const sourcePlatform = project?.sourcePlatform || detectSourcePlatform(project?.sourceUrl);
  const selectableLists = lists.filter((list) => list.id !== "favorites");

  useEffect(() => {
    setSourceUrlDraft(project?.sourceUrl ?? "");
  }, [project?.sourceUrl]);

  useEffect(() => {
    if (!project) return;
    let ignore = false;

    async function loadGuestLinks() {
      try {
        const response = await fetch(`/api/projects/${project?.id}/guest-links`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { links?: GuestLink[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? text(settings.language, "Gastlinks konnten nicht geladen werden.", "Guest links could not be loaded."));
        }
        if (!ignore) {
          setGuestLinks(payload.links ?? []);
        }
      } catch (error) {
        if (!ignore) {
          setGuestLinkStatus(
            error instanceof Error
              ? error.message
              : text(settings.language, "Gastlinks konnten nicht geladen werden.", "Guest links could not be loaded."),
          );
        }
      }
    }

    void loadGuestLinks();
    return () => {
      ignore = true;
    };
  }, [project, settings.language]);

  useEffect(() => {
    if (!project) return;
    const fileTree = buildFileTree(project.files.filter((file) => file.type !== "PDF"));
    const printedTree = buildFileTree(project.files);
    const fileFolders = collectTreeFolderPaths(fileTree);
    const printedFolders = collectTreeFolderPaths(printedTree);
    setCollapsedFileFolders(new Set(fileFolders));
    setCollapsedPrintedFolders(new Set(printedFolders));
  }, [project]);

  if (!project && !ready) {
    return <ProjectLoadingState />;
  }

  if (!project) {
    return <ProjectNotFoundState />;
  }

  const currentProject = project;
  const modelFiles = currentProject.files.filter((file) => file.type !== "PDF");
  const pdfFiles = currentProject.files.filter((file) => file.type === "PDF");
  const fileTree = buildFileTree(modelFiles);
  const activity = currentProject.activity ?? {
    isActive: false,
    printedFileIds: [],
    steps: [],
    shoppingList: [],
    links: [],
  };
  const printedProgressTotal = currentProject.files.length;
  const printedProgressDone = activity.printedFileIds.length;
  const printedProgressPercent = printedProgressTotal
    ? Math.round((printedProgressDone / printedProgressTotal) * 100)
    : 0;
  const stepsProgressTotal = activity.steps.length;
  const setupItemsTotal = activity.shoppingList.length + activity.links.length;

  function saveActivity(next: typeof activity) {
    updateProjectActivity(currentProject.id, next);
  }

  function renderFileCards(files: PrintFile[]) {
    return files.map((file) => (
      <FileCard
        key={file.id}
        file={file}
        isActive={file.id === (selectedFile?.id || thumbnailFile?.id)}
        isSelected={selectedFileIds.has(file.id)}
        onToggleSelect={() => setSelectedFileIds((prev) => {
          const next = new Set(prev);
          if (next.has(file.id)) next.delete(file.id);
          else next.add(file.id);
          return next;
        })}
        onView={() => setSelectedFileId(file.id)}
        onDelete={() => deleteFileFromProject(currentProject.id, file.id)}
        onSetThumbnail={() => { setSelectedFileId(file.id); setProjectThumbnail(currentProject.id, file.id); }}
      />
    ));
  }

  function renderFileTree(node: FileTreeNode, depth = 0): ReactNode {
    const directFiles = node.files;
    const children = node.children;

    if (node.path === "") {
      return (
        <div className="space-y-4">
          {directFiles.length > 0 ? <div className="space-y-3">{renderFileCards(directFiles)}</div> : null}
          {children.map((child) => renderFileTree(child, depth))}
        </div>
      );
    }

    const allNodeFiles = [
      ...directFiles,
      ...children.flatMap(function flatten(child): PrintFile[] {
        return [...child.files, ...child.children.flatMap(flatten)];
      }),
    ];
    const isCollapsed = collapsedFileFolders.has(node.path);
    const allSelected = allNodeFiles.length > 0 && allNodeFiles.every((file) => selectedFileIds.has(file.id));
    const someSelected = allNodeFiles.some((file) => selectedFileIds.has(file.id));

    return (
      <section key={node.path} className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel-muted)_70%,transparent)]">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ paddingLeft: `${16 + depth * 16}px` }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
            onChange={(event) => {
              setSelectedFileIds((prev) => {
                const next = new Set(prev);
                allNodeFiles.forEach((file) => {
                  if (event.target.checked) next.add(file.id);
                  else next.delete(file.id);
                });
                return next;
              });
            }}
          />
          <button
            type="button"
            onClick={() =>
              setCollapsedFileFolders((prev) => {
                const next = new Set(prev);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              })
            }
            className="flex flex-1 items-center gap-2 text-left"
            style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-main)" }}
          >
            <span aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
            <span>📁 {node.name}</span>
          </button>
          <span className="badge badge-neutral">{allNodeFiles.length}</span>
        </div>
        {!isCollapsed ? (
          <div className="space-y-3 border-t border-[var(--border)] p-3">
            {directFiles.length > 0 ? <div className="space-y-3">{renderFileCards(directFiles)}</div> : null}
            {children.map((child) => renderFileTree(child, depth + 1))}
          </div>
        ) : null}
      </section>
    );
  }

  async function handleProjectZipExport(filesToExport = currentProject.files, label = "project") {
    try {
      if (!filesToExport.length) {
        setExportStatus(text(settings.language, "Keine Dateien ausgewählt.", "No files selected."));
        return;
      }

      setExportStatus(
        label === "selection"
          ? text(settings.language, "Erstelle ZIP aus Auswahl...", "Building ZIP from selection...")
          : text(settings.language, "Erstelle Projekt-ZIP...", "Building project ZIP..."),
      );
      setExportProgress(0);

      const zip = new JSZip();
      const folderName = currentProject.title.replace(/[<>:\"/\\|?*]+/g, "-") || "project";
      const projectFolder = zip.folder(folderName);

      if (!projectFolder) {
        throw new Error(
          text(settings.language, "ZIP konnte nicht erstellt werden.", "ZIP could not be created."),
        );
      }

      const infoLines = [
        `Title: ${currentProject.title}`,
        `Description: ${currentProject.description || "-"}`,
        `Author: ${currentProject.author || "-"}`,
        `License: ${currentProject.license || "-"}`,
        `Category: ${category ? `${category.emoji} ${category.name}` : "-"}`,
        `Creator: ${creator ? creator.name : "-"}`,
        `Creator Folder: ${creatorFolder ? creatorFolder.name : "-"}`,
        `Original Link: ${currentProject.sourceUrl || "-"}`,
        `Source Platform: ${sourcePlatform || "-"}`,
        `Favorite: ${currentProject.favorite ? "yes" : "no"}`,
        `Created At: ${currentProject.createdAt}`,
        `Updated At: ${currentProject.updatedAt}`,
        `Tags: ${currentProject.tags.join(", ") || "-"}`,
        "",
        "Files:",
        ...filesToExport.map(
          (file) =>
            `- ${file.storedPath} | ${file.type} | ${file.sizeLabel} | source=${file.source} | original=${file.originalPath || file.originalName}`,
        ),
      ].join("\n");

      projectFolder.file("project-info.txt", infoLines);
      projectFolder.file(
        "project-info.json",
        JSON.stringify(
          {
            title: currentProject.title,
            description: currentProject.description,
            author: currentProject.author,
            license: currentProject.license,
            category: category ? { id: category.id, name: category.name, emoji: category.emoji } : null,
            creator: creator ? { id: creator.id, name: creator.name } : null,
            creatorFolder: creatorFolder ? { id: creatorFolder.id, name: creatorFolder.name } : null,
            originalLink: currentProject.sourceUrl ?? "",
            sourcePlatform,
            favorite: currentProject.favorite,
            tags: currentProject.tags,
            createdAt: currentProject.createdAt,
            updatedAt: currentProject.updatedAt,
            exportScope: label,
            files: filesToExport.map((file) => ({
              name: file.name,
              type: file.type,
              sizeBytes: file.sizeBytes,
              sizeLabel: file.sizeLabel,
              originalPath: file.originalPath || file.originalName,
              storedPath: file.storedPath,
              source: file.source,
              notes: file.notes,
            })),
          },
          null,
          2,
        ),
      );

      for (const [index, file] of filesToExport.entries()) {
        const loadedPercent = Math.round((index / filesToExport.length) * 45);
        setExportProgress(loadedPercent);
        setExportStatus(
          text(
            settings.language,
            `Bereite Datei ${index + 1}/${filesToExport.length} vor: ${file.name}`,
            `Preparing file ${index + 1}/${filesToExport.length}: ${file.name}`,
          ),
        );
        const blob = await getFileBlob(file.id);
        if (!blob) {
          continue;
        }
        projectFolder.file(
          file.storedPath.replace(/^Projects\//, ""),
          blob,
        );
      }

      setExportStatus(text(settings.language, "Packe ZIP-Archiv...", "Packing ZIP archive..."));
      const archive = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
        (metadata) => {
          const packedPercent = Math.round(45 + metadata.percent * 0.55);
          setExportProgress(Math.min(100, packedPercent));
          setExportStatus(
            text(
              settings.language,
              `Packe ZIP-Archiv... ${Math.round(metadata.percent)}%`,
              `Packing ZIP archive... ${Math.round(metadata.percent)}%`,
            ),
          );
        },
      );
      const downloadUrl = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      setExportStatus(
        label === "selection"
          ? text(settings.language, "Auswahl-ZIP wurde erstellt.", "Selection ZIP created.")
          : text(settings.language, "Projekt-ZIP wurde erstellt.", "Project ZIP created."),
      );
      setExportProgress(100);
      window.setTimeout(() => setExportProgress(null), 4000);
    } catch (error) {
      setExportProgress(null);
      setExportStatus(
        error instanceof Error
          ? error.message
          : text(settings.language, "ZIP-Export fehlgeschlagen.", "ZIP export failed."),
      );
    }
  }

  function handleSelectedZipExport() {
    const files = pickSelectedZipFiles(currentProject.files, selectedFileIds);
    void handleProjectZipExport(files, "selection");
  }

  async function handleShareProject() {
    try {
      const shareUrl = `${window.location.origin}/project/${currentProject.id}`;
      if (navigator.share) {
        await navigator.share({
          title: currentProject.title,
          text: currentProject.description,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareStatus(
        text(settings.language, "Projektlink geteilt.", "Project link shared."),
      );
    } catch {
      setShareStatus(
        text(settings.language, "Projektlink konnte nicht geteilt werden.", "Project link could not be shared."),
      );
    }
  }

  async function refreshGuestLinks() {
    const response = await fetch(`/api/projects/${currentProject.id}/guest-links`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as { links?: GuestLink[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? text(settings.language, "Gastlinks konnten nicht geladen werden.", "Guest links could not be loaded."));
    }
    setGuestLinks(payload.links ?? []);
  }

  async function handleCreateGuestLink() {
    try {
      setGuestLinkStatus(text(settings.language, "Erstelle Gastlink...", "Creating guest link..."));
      const response = await fetch(`/api/projects/${currentProject.id}/guest-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: text(settings.language, "Gastlink", "Guest link"),
        }),
      });
      const payload = (await response.json()) as { link?: GuestLink; error?: string };
      if (!response.ok || !payload.link) {
        throw new Error(payload.error ?? text(settings.language, "Gastlink konnte nicht erstellt werden.", "Guest link could not be created."));
      }
      setGuestLinks((current) => [payload.link as GuestLink, ...current]);
      try {
        await navigator.clipboard?.writeText(payload.link.url);
      } catch {
        setGuestLinkStatus(
          text(settings.language, "Gastlink erstellt. Kopieren im Browser nicht erlaubt, der Link steht unten.", "Guest link created. Browser copy is blocked, the link is shown below."),
        );
        return;
      }
      setGuestLinkStatus(
        text(settings.language, "Gastlink erstellt und kopiert.", "Guest link created and copied."),
      );
    } catch (error) {
      setGuestLinkStatus(
        error instanceof Error
          ? error.message
          : text(settings.language, "Gastlink konnte nicht erstellt werden.", "Guest link could not be created."),
      );
    }
  }

  async function handleRevokeGuestLink(linkId: string) {
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/guest-links/${linkId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? text(settings.language, "Gastlink konnte nicht deaktiviert werden.", "Guest link could not be revoked."));
      }
      await refreshGuestLinks();
      setGuestLinkStatus(text(settings.language, "Gastlink deaktiviert.", "Guest link revoked."));
    } catch (error) {
      setGuestLinkStatus(
        error instanceof Error
          ? error.message
          : text(settings.language, "Gastlink konnte nicht deaktiviert werden.", "Guest link could not be revoked."),
      );
    }
  }

  async function openFilesViaBridge(files: PrintFile[]) {
    if (!files.length) {
      setSlicerMultiStatus(
        text(settings.language, "Keine Dateien ausgewählt.", "No files selected."),
      );
      return;
    }

    setSlicerMultiStatus(
      text(
        settings.language,
        "Sende Dateien an makershelf Bridge...",
        "Sending files to makershelf Bridge...",
      ),
    );

    const app =
      settings.preferredSlicer === "prusa"
        ? "prusa"
        : settings.preferredSlicer === "orca"
          ? "orca"
          : "bambu";

    const response = await fetch("/api/files/bridge-manifest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: files.map((file) => file.id) }),
    });
    const data = (await response.json()) as { manifestUrl?: string; error?: string };
    if (!response.ok || !data.manifestUrl) {
      throw new Error(data.error ?? text(settings.language, "Bridge-Manifest konnte nicht erstellt werden.", "Bridge manifest could not be created."));
    }

    const bridgeUrl =
      `makershelf://open?manifestUrl=${encodeURIComponent(data.manifestUrl)}&app=${app}`;
    window.location.href = bridgeUrl;

    setSlicerMultiStatus(
      text(
        settings.language,
        `${files.length} Datei(en) an die Bridge gesendet. Browser-Anfrage bitte bestätigen.`,
        `${files.length} file(s) sent to the bridge. Please confirm the browser prompt.`,
      ),
    );
  }

  async function handleOpenSelectedInSlicer() {
    const files = currentProject.files.filter((file) => selectedFileIds.has(file.id));

    const bridgeInstalled =
      typeof window !== "undefined" && localStorage.getItem(BRIDGE_KEY) === "1";

    if (!bridgeInstalled) {
      setPendingBridgeFiles(files);
      setShowBridgeModal(true);
      return;
    }

    try {
      await openFilesViaBridge(files);
    } catch (error) {
      setSlicerMultiStatus(
        error instanceof Error
          ? error.message
          : text(settings.language, "Bridge konnte nicht gestartet werden.", "Bridge could not be started."),
      );
    }
    setTimeout(() => setSlicerMultiStatus(""), 6000);
  }

  return (
    <div className="space-y-8">
      {showBridgeModal && (
        <BridgeSetupModal
          onInstalled={() => {
            localStorage.setItem(BRIDGE_KEY, "1");
            setShowBridgeModal(false);
            const files = pendingBridgeFiles;
            setPendingBridgeFiles([]);
            void openFilesViaBridge(files);
          }}
          onSkip={() => {
            setShowBridgeModal(false);
            setPendingBridgeFiles([]);
          }}
        />
      )}
      <section className="panel-technical grid gap-8 p-8 md:p-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative space-y-6">
          <div className="flex flex-wrap gap-2">
            {category ? (
              <Link href={`/projects?category=${encodeURIComponent(category.id)}`} className="badge-tech px-3 py-1 text-xs font-semibold no-underline">
                {category.emoji} {category.name}
              </Link>
            ) : null}
            {creator ? (
              <Link href={`/projects?creator=${encodeURIComponent(creator.id)}`} className="accent-soft rounded-full px-3 py-1 text-xs font-semibold no-underline">
                Creator: {creator.name}
                {creatorFolder ? ` / ${creatorFolder.name}` : ""}
              </Link>
            ) : null}
            <span className="secondary-soft rounded-full px-3 py-1 text-xs font-semibold">
              {project.license}
            </span>
            {project.favorite ? (
              <span className="badge-tech px-3 py-1 text-xs font-semibold">{text(settings.language, "Favorit", "Favourite")}</span>
            ) : null}
          </div>

          <div>
            <h1 className="text-4xl font-black tracking-tight text-main">
              {project.title}
            </h1>
            <p className="mt-4 max-w-3xl text-muted">{project.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <Link
                key={tag}
                href={`/projects?tag=${encodeURIComponent(tag)}`}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--primary-soft)", color: "var(--primary)", textDecoration: "none" }}
              >
                #{tag}
              </Link>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="metric-card">
              <p className="text-sm text-soft">
                {text(settings.language, "Modell-Designer", "Model designer")}
              </p>
              <p className="mt-2 text-lg font-semibold text-main">{project.author}</p>
            </div>
            <div className="metric-card">
              <p className="text-sm text-soft">
                {text(settings.language, "Importiert von", "Imported by")}
              </p>
              <p className="mt-2 text-lg font-semibold text-main">
                {project.createdByName || text(settings.language, "Unbekannt", "Unknown")}
              </p>
            </div>
            <div className="metric-card">
              <p className="text-sm text-soft">
                {text(settings.language, "Dateien", "Files")}
              </p>
              <p className="mt-2 text-sm font-semibold text-main">
                {project.files.length}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/edit-project/${project.id}`} className="btn btn-primary">
              {text(settings.language, "Projekt bearbeiten", "Edit project")}
            </Link>
            <button
              onClick={() => setProjectFavorite(project.id, !project.favorite)}
              className="btn btn-ghost"
            >
              {project.favorite
                ? text(settings.language, "Favorit entfernen", "Remove favorite")
                : text(settings.language, "Zu Favoriten", "Add to favorites")}
            </button>
            {project.sourceUrl ? (
              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
              >
                {sourcePlatform
                  ? text(
                      settings.language,
                      `Original auf ${sourcePlatform}`,
                      `Original on ${sourcePlatform}`,
                    )
                  : text(settings.language, "Original öffnen", "Open original")}
              </a>
            ) : null}
            <button
              onClick={() => void handleProjectZipExport()}
              className="btn btn-secondary"
            >
              {text(settings.language, "Alles als ZIP laden", "Download all as ZIP")}
            </button>
            <button
              onClick={() => void handleShareProject()}
              className="btn btn-ghost"
            >
              {text(settings.language, "Link teilen", "Share link")}
            </button>
            <button
              onClick={() => void handleCreateGuestLink()}
              className="btn btn-secondary"
            >
              {text(settings.language, "Gastlink erstellen", "Create guest link")}
            </button>
            <button
              onClick={() => setShowListMenu((current) => !current)}
              className="btn btn-ghost"
            >
              {showListMenu
                ? text(settings.language, "Listen schließen", "Close lists")
                : text(settings.language, "Zu Liste hinzufügen", "Add to lists")}
            </button>
          </div>
          {shareStatus ? <p className="text-sm text-muted">{shareStatus}</p> : null}
          {guestLinkStatus ? <p className="text-sm text-muted">{guestLinkStatus}</p> : null}
          <section className="panel mt-4 space-y-4 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-main">
                  {text(settings.language, "Gastzugriff", "Guest access")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {text(
                    settings.language,
                    "Öffentliche Links geben nur dieses Projekt frei, inklusive Download-Alles-ZIP.",
                    "Public links expose only this project, including the download-all ZIP.",
                  )}
                </p>
              </div>
            </div>
            {guestLinks.length > 0 ? (
              <div className="space-y-2">
                {guestLinks.map((link) => {
                  const revoked = Boolean(link.revokedAt);
                  return (
                    <div key={link.id} className="surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-main">
                          {link.label}
                          {revoked ? ` · ${text(settings.language, "deaktiviert", "revoked")}` : ""}
                        </p>
                        <a href={link.url} target="_blank" rel="noreferrer" className="block truncate text-xs accent-text">
                          {link.url}
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(link.url);
                            setGuestLinkStatus(text(settings.language, "Gastlink kopiert.", "Guest link copied."));
                          }}
                          className="btn btn-ghost btn-sm"
                        >
                          {text(settings.language, "Kopieren", "Copy")}
                        </button>
                        <a href={link.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                          {text(settings.language, "Öffnen", "Open")}
                        </a>
                        {!revoked ? (
                          <button
                            type="button"
                            onClick={() => void handleRevokeGuestLink(link.id)}
                            className="btn btn-ghost btn-sm"
                          >
                            {text(settings.language, "Deaktivieren", "Revoke")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {text(settings.language, "Noch kein Gastlink vorhanden.", "No guest link created yet.")}
              </p>
            )}
          </section>
          {showListMenu ? (
            <section className="panel mt-4 space-y-4 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-main">
                    {text(settings.language, "Projektlisten", "Project lists")}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {text(
                      settings.language,
                      "Lege Listen an und weise dieses Projekt direkt mehreren Sammlungen zu.",
                      "Create lists and assign this project directly to multiple collections.",
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  className="input"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder={text(settings.language, "Neue Liste", "New list")}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newListName.trim()) return;
                    await createList(newListName.trim());
                    setNewListName("");
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  {text(settings.language, "Liste anlegen", "Create list")}
                </button>
              </div>

              {selectableLists.length === 0 ? (
                <p className="text-sm text-muted">
                  {text(settings.language, "Noch keine eigenen Listen vorhanden.", "No custom lists created yet.")}
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectableLists.map((list) => {
                    const checked = list.projectIds.includes(currentProject.id);
                    return (
                      <label
                        key={list.id}
                        className="surface-subtle flex items-center gap-3 rounded-lg px-3 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              void addProjectToList(list.id, currentProject.id);
                            } else {
                              void removeProjectFromList(list.id, currentProject.id);
                            }
                          }}
                        />
                        <span className="text-sm font-medium text-main">{list.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-black/8">
          <div className="aspect-[4/3]">
            <ProjectThumbnail project={project} file={thumbnailFile} />
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
        <section
          className="section-shell relative h-fit self-start p-4"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false); }}
          onDrop={async (e) => {
            e.preventDefault(); e.stopPropagation(); setIsDragging(false);
            const files = Array.from(e.dataTransfer.files);
            if (!files.length) return;
            const archives = files.filter(f => isSupportedArchiveFile(f.name));
            const regular = files.filter(f => !isSupportedArchiveFile(f.name));
            const results: { added: number; skipped: number }[] = [];
            for (const archive of archives) {
              results.push(await addZipToProject(project.id, archive, zipMode, { preserveFolderStructure, onArchiveStatus: setUploadStatus }));
            }
            if (regular.length) {
              results.push(await addFilesToProject(project.id, regular, "upload", { preserveFolderStructure, onArchiveStatus: setUploadStatus }));
            }
            const added = results.reduce((s, r) => s + r.added, 0);
            const skipped = results.reduce((s, r) => s + r.skipped, 0);
            setUploadStatus(`${added} ${text(settings.language, "Dateien importiert", "files imported")}, ${skipped} ${text(settings.language, "übersprungen", "skipped")}.`);
          }}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
              <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
                {text(settings.language, "Dateien hier ablegen", "Drop files here")}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-main">
              {text(settings.language, "Dateien & ZIP", "Files & ZIP")}
            </p>
            <span className="text-xs uppercase tracking-[0.2em] text-soft">3D / Archiv</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="subgrid-card">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-main">
                  {text(settings.language, "Datei-Upload", "File upload")}
                </p>
                <span className="text-[11px] uppercase tracking-[0.16em] text-soft">3D</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">
                {text(
                  settings.language,
                  "Einzelne Dateien oder ganze Ordner mit Druckdateien.",
                  "Single files or whole folders with print files.",
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="btn btn-primary">
                  {text(settings.language, "Dateien auswählen", "Choose files")}
                  <input
                    type="file"
                    multiple
                    accept={uploadAccept}
                    className="hidden"
                    onChange={async (event) => {
                      if (event.target.files?.length) {
                        const result = await addFilesToProject(project.id, event.target.files, "upload", {
                          preserveFolderStructure,
                          onArchiveStatus: setUploadStatus,
                        });
                        setUploadStatus(
                          text(settings.language, `${result.added} Dateien importiert, ${result.skipped} übersprungen.`, `${result.added} files imported, ${result.skipped} skipped.`),
                        );
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
                <label className="btn btn-ghost">
                  {text(settings.language, "Ordner auswählen", "Choose folder")}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    {...({ webkitdirectory: "true", directory: "true" } as Record<string, string>)}
                    onChange={async (event) => {
                      if (event.target.files?.length) {
                        const result = await addFilesToProject(project.id, event.target.files, "upload", {
                          preserveFolderStructure,
                          onArchiveStatus: setUploadStatus,
                        });
                        setUploadStatus(
                          text(settings.language, `${result.added} Dateien importiert, ${result.skipped} übersprungen.`, `${result.added} files imported, ${result.skipped} skipped.`),
                        );
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="subgrid-card">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-main">
                  {text(settings.language, "Archiv importieren", "Import archive")}
                </p>
                <span className="text-[11px] uppercase tracking-[0.16em] text-soft">RAR / 7z / ZIP</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">
                {text(
                  settings.language,
                  "Archiv behalten oder direkt entpacken. ZIP, RAR, 7z, TAR und GZ werden unterstützt.",
                  "Keep archive or import extracted. ZIP, RAR, 7z, TAR and GZ are supported.",
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className="input"
                  value={zipMode}
                  onChange={(event) => setZipMode(event.target.value as "extract" | "archive")}
                >
                  <option value="extract">
                    {text(settings.language, "Entpackt importieren", "Import extracted")}
                  </option>
                  <option value="archive">
                    {text(settings.language, "Als Archiv speichern", "Store archive")}
                  </option>
                </select>
                <label className="btn btn-secondary">
                  {text(settings.language, "Archiv auswählen", "Choose archive")}
                  <input
                    type="file"
                    accept={ARCHIVE_FILE_ACCEPT}
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        const result = await addZipToProject(project.id, file, zipMode, {
                          preserveFolderStructure,
                          onArchiveStatus: setUploadStatus,
                        });
                        setUploadStatus(
                          text(settings.language, `${result.added} Archiv-Dateien importiert, ${result.skipped} übersprungen.`, `${result.added} archive files imported, ${result.skipped} skipped.`),
                        );
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <label className="surface-subtle mt-3 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-main">
            <input
              type="checkbox"
              checked={preserveFolderStructure}
              onChange={(event) => setPreserveFolderStructure(event.target.checked)}
            />
            <span>{text(settings.language, "Ordnerstruktur übernehmen", "Preserve folder structure")}</span>
            <span className="text-xs font-normal text-muted">
              {text(
                settings.language,
                "Standardmäßig aktiv: Archiv- und Ordnerimporte behalten Unterordner im Projekt bei.",
                "Enabled by default: archive and folder imports keep subfolders in the project.",
              )}
            </span>
          </label>
          {uploadStatus ? <p className="mt-3 text-xs text-muted">{uploadStatus}</p> : null}
        </section>

        <section className="section-shell self-start p-4">
          <p className="text-lg font-semibold text-main">
            {text(settings.language, "Original-Link & Import", "Original link & import")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {text(
              settings.language,
              "Quell-Link setzen und/oder Metadaten von der Website importieren. Plattformen wie Printables, Thingiverse oder Cults3D werden automatisch erkannt.",
              "Set the source link and/or import metadata from the website. Platforms like Printables, Thingiverse or Cults3D are detected automatically.",
            )}
          </p>
          <div className="mt-3 space-y-3">
            <input
              className="input"
              value={sourceUrlDraft}
              onChange={(event) => setSourceUrlDraft(event.target.value)}
              placeholder="https://www.printables.com/model/..."
            />
            <p className="rounded-xl border border-black/8 px-3 py-2 text-xs text-muted">
              {text(
                settings.language,
                "Sperrfelder aus \"Projekt bearbeiten\" werden beim Metadaten-Import berücksichtigt.",
                "Locked fields from \"Edit project\" are respected during metadata import.",
              )}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={async () => {
                  try {
                    await updateProject(project.id, {
                      title: project.title,
                      description: project.description,
                      categoryId: project.categoryId,
                      license: project.license,
                      tags: project.tags,
                      author: project.author,
                      sourceUrl: sourceUrlDraft || project.sourceUrl,
                      coverImage: project.coverImage,
                      creatorId: project.creatorId,
                      creatorFolderId: project.creatorFolderId,
                      lockedFields: project.lockedFields,
                    });
                    setMetadataStatus(
                      text(settings.language, "Original-Link gespeichert.", "Original link saved."),
                    );
                  } catch (error) {
                    setMetadataStatus(
                      error instanceof Error ? error.message : text(settings.language, "Fehler beim Speichern.", "Save failed."),
                    );
                  }
                }}
              >
                {text(settings.language, "Link speichern", "Save link")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={async () => {
                  const url = sourceUrlDraft || project.sourceUrl;
                  if (!url) {
                    setMetadataStatus(text(settings.language, "Bitte zuerst einen Link eingeben.", "Please enter a link first."));
                    return;
                  }
                  setMetadataStatus(text(settings.language, "Lade Metadaten...", "Loading metadata..."));
                  try {
                    const response = await fetch("/api/import-metadata", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url }),
                    });
                    const data = (await response.json()) as {
                      error?: string;
                      title?: string;
                      description?: string;
                      author?: string;
                      category?: string;
                      license?: string;
                      tags?: string[];
                      images?: string[];
                      sourcePlatform?: string;
                      fileLinks?: string[];
                      warnings?: string[];
                      sourceUrl: string;
                    };
                    if (!response.ok) {
                      throw new Error(data.error || text(settings.language, "Import fehlgeschlagen.", "Import failed."));
                    }
                    await updateProjectLocks(project.id, project.lockedFields);
                    await importWebsiteMetadataToProject(project.id, data);
                    let nextStatus = text(
                      settings.language,
                      `Metadaten von ${detectSourcePlatform(data.sourceUrl) || "der Website"} übernommen.`,
                      `Imported metadata from ${detectSourcePlatform(data.sourceUrl) || "the website"}.`,
                    );
                    if (data.fileLinks?.length) {
                      const filesResponse = await fetch("/api/import-remote-files", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ urls: data.fileLinks }),
                      });
                      const remoteData = (await filesResponse.json()) as {
                        error?: string;
                        skipped?: number;
                        files?: Array<{
                          name: string;
                          mimeType?: string;
                          data: number[];
                          sourceUrl?: string;
                        }>;
                      };
                      if (filesResponse.ok && remoteData.files?.length) {
                        const imported = await addRemoteFilesToProject(project.id, remoteData.files, "website");
                        nextStatus = `${nextStatus} ${text(settings.language, `${imported.added} Datei(en) aus dem Link importiert, ${imported.skipped + (remoteData.skipped ?? 0)} übersprungen.`, `${imported.added} file(s) imported from link, ${imported.skipped + (remoteData.skipped ?? 0)} skipped.`)}`;
                      } else if (!filesResponse.ok && remoteData.error) {
                        nextStatus = `${nextStatus} ${text(settings.language, `Dateiimport: ${remoteData.error}`, `File import: ${remoteData.error}`)}`;
                      }
                    }
                    setMetadataStatus(nextStatus);
                    if (data.warnings?.length) {
                      setMetadataStatus((current) => `${current} ${data.warnings?.join(" ")}`);
                    }
                  } catch (error) {
                    setMetadataStatus(
                      error instanceof Error ? error.message : text(settings.language, "Import fehlgeschlagen.", "Import failed."),
                    );
                  }
                }}
              >
                {text(settings.language, "Metadaten laden", "Load metadata")}
              </button>
            </div>
            {metadataStatus ? (
              <p className="text-xs text-muted">{metadataStatus}</p>
            ) : null}
          </div>
        </section>
        </div>

        <aside className="xl:sticky xl:top-6">
          <LicenseSummary license={project.license} />
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("files")}
              className={`btn ${activeTab === "files" ? "btn-primary" : "btn-ghost"}`}
            >
              {text(settings.language, "Dateien", "Files")}
            </button>
            <button
              onClick={() => setActiveTab("pdfs")}
              className={`btn ${activeTab === "pdfs" ? "btn-primary" : "btn-ghost"}`}
            >
              PDF ({pdfFiles.length})
            </button>
            <button
              onClick={() => setActiveTab("overview")}
              className={`btn ${activeTab === "overview" ? "btn-primary" : "btn-ghost"}`}
            >
              {text(settings.language, "Übersicht", "Overview")}
            </button>
            <button
              onClick={() => setActiveTab("printed")}
              className={`btn ${activeTab === "printed" ? "btn-primary" : "btn-ghost"}`}
            >
              {text(settings.language, "Gedruckte Dateien", "Printed files")}
            </button>
            <button
              onClick={() => setActiveTab("bom")}
              className={`btn ${activeTab === "bom" ? "btn-primary" : "btn-ghost"}`}
            >
              BOM
            </button>
            <button
              onClick={() => setActiveTab("steps")}
              className={`btn ${activeTab === "steps" ? "btn-primary" : "btn-ghost"}`}
            >
              {text(settings.language, "Schritte", "Steps")}
            </button>
            <button
              onClick={() => setActiveTab("links")}
              className={`btn ${activeTab === "links" ? "btn-primary" : "btn-ghost"}`}
            >
              {text(settings.language, "Links", "Links")}
            </button>
          </div>

          {activeTab === "files" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-black tracking-tight text-main">
                  {text(settings.language, "Dateien im Projektordner", "Files in project folder")}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedFileIds.size > 0 && (
                    <>
                      <span className="badge badge-neutral">{selectedFileIds.size} {text(settings.language, "ausgewählt", "selected")}</span>
                      <button
                        onClick={() => void handleOpenSelectedInSlicer()}
                        className="btn btn-primary btn-sm"
                      >
                        {text(settings.language, "Alle im Slicer öffnen", "Open all in slicer")}
                      </button>
                      <button
                        onClick={handleSelectedZipExport}
                        className="btn btn-secondary btn-sm"
                      >
                        {text(
                          settings.language,
                          `Ausgewählte als ZIP laden (${selectedFileIds.size})`,
                          `Download selected as ZIP (${selectedFileIds.size})`,
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedFileIds(new Set())}
                        className="btn btn-ghost btn-sm"
                      >
                        {text(settings.language, "Auswahl aufheben", "Deselect all")}
                      </button>
                    </>
                  )}
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={modelFiles.length > 0 && modelFiles.every((file) => selectedFileIds.has(file.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedFileIds(new Set(modelFiles.map((f) => f.id)));
                        else setSelectedFileIds(new Set());
                      }}
                    />
                    {text(settings.language, "Alle", "All")}
                  </label>
                  <select
                    className="input"
                    style={{ height: "32px", padding: "0 10px", fontSize: "12px", minWidth: "120px" }}
                    value={filesSort}
                    onChange={(e) => setFilesSort(e.target.value as typeof filesSort)}
                  >
                    <option value="folder">{text(settings.language, "Nach Ordner", "By folder")}</option>
                    <option value="name">{text(settings.language, "Nach Name", "By name")}</option>
                    <option value="type">{text(settings.language, "Nach Typ", "By type")}</option>
                    <option value="size">{text(settings.language, "Nach Größe", "By size")}</option>
                  </select>
                </div>
              </div>
              {slicerMultiStatus && <p className="text-sm text-muted">{slicerMultiStatus}</p>}

              {filesSort === "folder" ? (
                modelFiles.length > 0 ? (
                  <div className="space-y-4">{renderFileTree(fileTree)}</div>
                ) : (
                  <section className="panel p-6 text-sm text-muted">
                    {text(settings.language, "Keine Druckdateien vorhanden. PDFs findest du im PDF-Tab.", "No print files available. PDFs are shown in the PDF tab.")}
                  </section>
                )
              ) : (
                <div className="space-y-4">
                  {[...modelFiles]
                    .sort((a, b) => {
                      if (filesSort === "name") return a.name.localeCompare(b.name);
                      if (filesSort === "type") return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
                      if (filesSort === "size") return b.sizeBytes - a.sizeBytes;
                      return 0;
                    })
                    .map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        isActive={file.id === (selectedFile?.id || thumbnailFile?.id)}
                        isSelected={selectedFileIds.has(file.id)}
                        onToggleSelect={() => setSelectedFileIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(file.id)) next.delete(file.id); else next.add(file.id);
                          return next;
                        })}
                        onView={() => setSelectedFileId(file.id)}
                        onDelete={() => deleteFileFromProject(project.id, file.id)}
                        onSetThumbnail={() => { setSelectedFileId(file.id); setProjectThumbnail(project.id, file.id); }}
                      />
                    ))}
                </div>
              )}
            </>
          ) : activeTab === "pdfs" ? (
            <section className="panel space-y-4 p-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-main">PDF</h2>
                <p className="mt-2 text-sm text-muted">
                  {text(
                    settings.language,
                    "Anleitungen, Lizenzdateien und Begleitdokumente sind hier getrennt von den Druckdateien gesammelt.",
                    "Manuals, license files and supporting documents are collected here separately from print files.",
                  )}
                </p>
              </div>
              {pdfFiles.length ? (
                <div className="space-y-3">{renderFileCards(pdfFiles)}</div>
              ) : (
                <p className="text-sm text-muted">
                  {text(settings.language, "Keine PDF-Dateien in diesem Projekt.", "No PDF files in this project.")}
                </p>
              )}
            </section>
          ) : activeTab === "overview" ? (
            <section className="panel space-y-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-main">
                    {text(settings.language, "Projektübersicht", "Project overview")}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {text(
                      settings.language,
                      "Verfolge Druckfortschritt, Aufgaben, Einkäufe und wichtige Links für dieses Projekt.",
                      "Track print progress, tasks, shopping items and useful links for this project.",
                    )}
                  </p>
                </div>
                <button
                  onClick={() => saveActivity({ ...activity, isActive: !activity.isActive })}
                  className={activity.isActive ? "btn btn-secondary" : "btn btn-ghost"}
                >
                  {activity.isActive
                    ? text(settings.language, "Projekt ist aktiv", "Project is active")
                    : text(settings.language, "Als aktiv setzen", "Set active")}
                  </button>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel-strong)_88%,transparent)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-soft">
                      {text(settings.language, "Projektfortschritt", "Project progress")}
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-main">
                      {printedProgressPercent}%
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {text(
                        settings.language,
                        `${printedProgressDone} von ${printedProgressTotal} Dateien als gedruckt markiert`,
                        `${printedProgressDone} of ${printedProgressTotal} files marked as printed`,
                      )}
                    </p>
                  </div>
                  <div className="grid gap-1 text-right text-sm text-muted">
                    <span>
                      {text(
                        settings.language,
                        `${stepsProgressTotal} Schritte geplant`,
                        `${stepsProgressTotal} planned steps`,
                      )}
                    </span>
                    <span>
                      {text(
                        settings.language,
                        `${setupItemsTotal} BOM- und Link-Einträge`,
                        `${setupItemsTotal} BOM and link items`,
                      )}
                    </span>
                  </div>
                </div>
                <div className="progress-shell mt-5 h-4">
                  <div
                    className="progress-fill h-full"
                    style={{ width: `${Math.max(printedProgressPercent, printedProgressDone > 0 ? 6 : 0)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-soft">
                  <span>
                    {text(settings.language, "Nicht begonnen", "Not started")}
                  </span>
                  <span>
                    {text(settings.language, "Teilweise gedruckt", "Partially printed")}
                  </span>
                  <span>
                    {text(settings.language, "Alles gedruckt", "Fully printed")}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="surface-subtle rounded-lg px-4 py-4">
                  <p className="text-sm text-muted">{text(settings.language, "Gedruckte Dateien", "Printed files")}</p>
                  <p className="mt-2 text-2xl font-black text-main">{activity.printedFileIds.length}</p>
                </div>
                <div className="surface-subtle rounded-lg px-4 py-4">
                  <p className="text-sm text-muted">BOM</p>
                  <p className="mt-2 text-2xl font-black text-main">{activity.shoppingList.length}</p>
                </div>
                <div className="surface-subtle rounded-lg px-4 py-4">
                  <p className="text-sm text-muted">{text(settings.language, "Schritte", "Steps")}</p>
                  <p className="mt-2 text-2xl font-black text-main">{activity.steps.length}</p>
                </div>
                <div className="surface-subtle rounded-lg px-4 py-4">
                  <p className="text-sm text-muted">{text(settings.language, "Links", "Links")}</p>
                  <p className="mt-2 text-2xl font-black text-main">{activity.links.length}</p>
                </div>
              </div>
            </section>
          ) : activeTab === "printed" ? (
            <section className="panel space-y-3 p-6">
              <h2 className="text-2xl font-black tracking-tight text-main">
                {text(settings.language, "Gedruckte Dateien", "Printed files")}
              </h2>
              {(() => {
                const filesByFolder = currentProject.files.reduce<Record<string, typeof currentProject.files[number][]>>(
                  (acc, file) => {
                    const folder = file.folderPath || "";
                    acc[folder] = [...(acc[folder] ?? []), file];
                    return acc;
                  },
                  {},
                );
                const folders = Object.keys(filesByFolder).sort();
                return folders.map((folder) => {
                  const folderFiles = filesByFolder[folder];
                  const allChecked = folderFiles.every((f) => activity.printedFileIds.includes(f.id));
                  const someChecked = folderFiles.some((f) => activity.printedFileIds.includes(f.id));
                  const isCollapsed = collapsedPrintedFolders.has(folder);
                  const folderLabel = folder || text(settings.language, "Hauptordner", "Root folder");
                  return (
                    <div key={folder} className="space-y-2">
                        <div
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{ background: "var(--panel-muted)", borderBottom: "1px solid var(--border)" }}
                        >
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                            onChange={(e) => {
                              const ids = folderFiles.map((f) => f.id);
                              saveActivity({
                                ...activity,
                                printedFileIds: e.target.checked
                                  ? [...new Set([...activity.printedFileIds, ...ids])]
                                  : activity.printedFileIds.filter((id) => !ids.includes(id)),
                              });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedPrintedFolders((prev) => {
                                const next = new Set(prev);
                                if (next.has(folder)) next.delete(folder);
                                else next.add(folder);
                                return next;
                              })
                            }
                            className="flex flex-1 items-center gap-2 text-left"
                            style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}
                          >
                            <span aria-hidden="true">{isCollapsed ? "+" : "-"}</span>
                            <span>📁 {folderLabel}</span>
                          </button>
                          <span className="badge badge-neutral" style={{ marginLeft: "auto" }}>
                            {folderFiles.filter((f) => activity.printedFileIds.includes(f.id)).length}/{folderFiles.length}
                          </span>
                        </div>
                      {!isCollapsed && folderFiles.map((file) => {
                        const checked = activity.printedFileIds.includes(file.id);
                        const count = activity.printCounts?.[file.id] ?? 1;
                        return (
                          <div
                            key={file.id}
                            className="surface-subtle flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3"
                            style={file.id === selectedFileId ? { outline: "1px solid var(--primary)" } : {}}
                            onClick={() => setSelectedFileId(file.id)}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(event) =>
                                saveActivity({
                                  ...activity,
                                  printedFileIds: event.target.checked
                                    ? [...activity.printedFileIds, file.id]
                                    : activity.printedFileIds.filter((id) => id !== file.id),
                                })
                              }
                            />
                            <span className="flex-1 text-sm font-medium text-main">
                              {file.name}
                              <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                                {file.type}
                              </span>
                            </span>
                            {checked && (
                              <div
                                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>×</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={count}
                                  onChange={(e) => {
                                    const n = Math.max(1, parseInt(e.target.value) || 1);
                                    saveActivity({
                                      ...activity,
                                      printCounts: { ...activity.printCounts, [file.id]: n },
                                    });
                                  }}
                                  className="input"
                                  style={{ width: "60px", height: "30px", padding: "0 8px", textAlign: "center", fontSize: "13px" }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </section>
          ) : activeTab === "bom" ? (
            <section className="panel space-y-3 p-6">
              <h2 className="text-2xl font-black tracking-tight text-main">BOM</h2>
              <div className="flex gap-3">
                <input
                  className="input"
                  value={shoppingDraft}
                  onChange={(event) => setShoppingDraft(event.target.value)}
                  placeholder={text(settings.language, "Neuen BOM-Eintrag hinzufügen", "Add a new BOM item")}
                />
                <button
                  onClick={() => {
                    if (!shoppingDraft.trim()) return;
                    saveActivity({
                      ...activity,
                      shoppingList: [...activity.shoppingList, shoppingDraft.trim()],
                    });
                    setShoppingDraft("");
                  }}
                  className="btn btn-primary"
                >
                  {text(settings.language, "Hinzufügen", "Add")}
                </button>
              </div>
              <div className="space-y-2">
                {activity.shoppingList.map((item, index) => (
                  <div key={`${item}-${index}`} className="surface-subtle flex items-center justify-between rounded-lg px-4 py-3">
                    <span className="text-sm text-main">{item}</span>
                    <button
                      onClick={() =>
                        saveActivity({
                          ...activity,
                          shoppingList: activity.shoppingList.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      className="btn btn-ghost btn-sm"
                    >
                      {text(settings.language, "Entfernen", "Remove")}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : activeTab === "steps" ? (
            <section className="panel space-y-3 p-6">
              <h2 className="text-2xl font-black tracking-tight text-main">
                {text(settings.language, "Schritte", "Steps")}
              </h2>
              <div className="flex gap-3">
                <input
                  className="input"
                  value={stepDraft}
                  onChange={(event) => setStepDraft(event.target.value)}
                  placeholder={text(settings.language, "Neuen Schritt hinzufügen", "Add a new step")}
                />
                <button
                  onClick={() => {
                    if (!stepDraft.trim()) return;
                    saveActivity({ ...activity, steps: [...activity.steps, stepDraft.trim()] });
                    setStepDraft("");
                  }}
                  className="btn btn-primary"
                >
                  {text(settings.language, "Hinzufügen", "Add")}
                </button>
              </div>
              <div className="space-y-2">
                {activity.steps.map((step, index) => (
                  <div key={`${step}-${index}`} className="surface-subtle flex items-center justify-between rounded-lg px-4 py-3">
                    <span className="text-sm text-main">{step}</span>
                    <button
                      onClick={() =>
                        saveActivity({
                          ...activity,
                          steps: activity.steps.filter((_, stepIndex) => stepIndex !== index),
                        })
                      }
                      className="btn btn-ghost btn-sm"
                    >
                      {text(settings.language, "Entfernen", "Remove")}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="panel space-y-3 p-6">
              <h2 className="text-2xl font-black tracking-tight text-main">
                {text(settings.language, "Linksammlung", "Link collection")}
              </h2>
              <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr_auto]">
                <input
                  className="input"
                  value={linkLabelDraft}
                  onChange={(event) => setLinkLabelDraft(event.target.value)}
                  placeholder={text(settings.language, "Titel", "Title")}
                />
                <input
                  className="input"
                  value={linkUrlDraft}
                  onChange={(event) => setLinkUrlDraft(event.target.value)}
                  placeholder="https://"
                />
                <button
                  onClick={() => {
                    if (!linkUrlDraft.trim()) return;
                    saveActivity({
                      ...activity,
                      links: [
                        ...activity.links,
                        {
                          id: `link-${Date.now()}`,
                          label: linkLabelDraft.trim() || linkUrlDraft.trim(),
                          url: linkUrlDraft.trim(),
                        },
                      ],
                    });
                    setLinkLabelDraft("");
                    setLinkUrlDraft("");
                  }}
                  className="btn btn-primary"
                >
                  {text(settings.language, "Hinzufügen", "Add")}
                </button>
              </div>
              <div className="space-y-2">
                {activity.links.map((link) => (
                  <div key={link.id} className="surface-subtle flex items-center justify-between gap-3 rounded-lg px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-main">{link.label}</p>
                      <a href={link.url} target="_blank" rel="noreferrer" className="truncate text-xs accent-text">
                        {link.url}
                      </a>
                    </div>
                    <button
                      onClick={() =>
                        saveActivity({
                          ...activity,
                          links: activity.links.filter((entry) => entry.id !== link.id),
                        })
                      }
                      className="btn btn-ghost btn-sm"
                    >
                      {text(settings.language, "Entfernen", "Remove")}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6">
          <ThreeDViewer file={selectedFile || thumbnailFile} language={settings.language} />
        </aside>
      </section>

      {exportStatus ? (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-main">{exportStatus}</p>
            {exportProgress !== null ? (
              <span className="text-xs font-semibold text-muted">{exportProgress}%</span>
            ) : null}
          </div>
          {exportProgress !== null ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--panel-muted)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
