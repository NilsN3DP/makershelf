"use client";

import JSZip from "jszip";
import { useEffect, useMemo, useState } from "react";

import { LicenseSummary } from "@/src/components/projects/license-summary";
import { ProjectThumbnail } from "@/src/components/projects/project-thumbnail";
import { ThreeDViewer } from "@/src/components/projects/three-d-viewer";
import { collectTreeFolderPaths } from "@/src/lib/file-tree-collapse-core";
import type { PrintFile, Project } from "@/src/lib/makershelf-data";

type GuestProjectPageProps = {
  project: Project;
  token: string;
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
    ensureNode(file.folderPath || "").files.push(file);
  }

  function sortNode(node: FileTreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortNode);
  }

  sortNode(root);
  return root;
}

function guestDownloadUrl(token: string, fileId: string, inline = false) {
  const params = new URLSearchParams({ fileId });
  if (inline) params.set("inline", "1");
  return `/api/guest/${encodeURIComponent(token)}/download?${params.toString()}`;
}

function guestProjectZipUrl(token: string) {
  return `/api/guest/${encodeURIComponent(token)}/download?all=1`;
}

export function GuestProjectPage({ project, token }: GuestProjectPageProps) {
  const modelFiles = project.files.filter((file) => file.type !== "PDF");
  const pdfFiles = project.files.filter((file) => file.type === "PDF");
  const fileTree = useMemo(() => buildFileTree(modelFiles), [modelFiles]);
  const [selectedFileId, setSelectedFileId] = useState(
    project.thumbnailFileId ||
      modelFiles.find((file) => ["STL", "OBJ", "3MF", "GCODE", "STEP"].includes(file.type))?.id ||
      modelFiles[0]?.id ||
      pdfFiles[0]?.id ||
      "",
  );
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [exportStatus, setExportStatus] = useState("");
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const selectedFile = project.files.find((file) => file.id === selectedFileId) ?? modelFiles[0] ?? pdfFiles[0];
  const thumbnailFile = project.files.find((file) => file.id === project.thumbnailFileId);
  const selectedPdf = selectedFile?.type === "PDF" ? selectedFile : pdfFiles[0];

  useEffect(() => {
    setCollapsedFolders(new Set(collectTreeFolderPaths(fileTree)));
  }, [fileTree]);

  async function handleProjectZipDownload(filesToDownload: PrintFile[], label: "all" | "selection") {
    if (!filesToDownload.length) {
      setExportStatus("No files selected.");
      return;
    }

    setExportStatus(label === "all" ? "Creating project ZIP..." : "Creating selection ZIP...");
    setExportProgress(0);
    try {
      const zip = new JSZip();
      for (const [index, file] of filesToDownload.entries()) {
        setExportProgress(Math.round((index / filesToDownload.length) * 45));
        setExportStatus(`Preparing file ${index + 1}/${filesToDownload.length}: ${file.name}`);
        const response = await fetch(guestDownloadUrl(token, file.id, true));
        if (!response.ok) throw new Error(`${file.name} could not be loaded.`);
        const buffer = await response.arrayBuffer();
        const folderPath = file.folderPath?.trim();
        const zipPath = folderPath ? `${folderPath}/${file.name}` : file.name;
        zip.file(zipPath, buffer);
      }

      setExportStatus("Packing ZIP archive...");
      const blob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
        (metadata) => {
          setExportProgress(Math.min(100, Math.round(45 + metadata.percent * 0.55)));
          setExportStatus(`Packing ZIP archive... ${Math.round(metadata.percent)}%`);
        },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const suffix = label === "all" ? "project" : "selection";
      link.download = `${project.title.replace(/[<>:"/\\|?*]+/g, "-") || "project"}-${suffix}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus(label === "all" ? "Project ZIP created." : "Selection ZIP created.");
      setExportProgress(100);
      window.setTimeout(() => setExportProgress(null), 4000);
    } catch (error) {
      setExportProgress(null);
      setExportStatus(error instanceof Error ? error.message : "ZIP could not be created.");
    }
  }

  function handleSelectedZipDownload() {
    const selectedFiles = project.files.filter((file) => selectedFileIds.has(file.id));
    void handleProjectZipDownload(selectedFiles, "selection");
  }

  function renderFileRows(files: PrintFile[]) {
    return files.map((file) => {
      const isSelected = file.id === selectedFile?.id;
      return (
        <article
          key={file.id}
          onClick={() => setSelectedFileId(file.id)}
          className={`panel grid cursor-pointer gap-4 rounded-xl p-5 transition md:grid-cols-[1.2fr_0.8fr] ${
            isSelected
              ? "border-[var(--primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_40%,transparent)]"
              : selectedFileIds.has(file.id)
                ? "border-[var(--primary)]/60 bg-[color-mix(in_srgb,var(--primary-soft)_40%,transparent)]"
                : "hover:border-[var(--primary)]/50"
          }`}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="checkbox"
                checked={selectedFileIds.has(file.id)}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();
                  setSelectedFileIds((current) => {
                    const next = new Set(current);
                    if (next.has(file.id)) next.delete(file.id);
                    else next.add(file.id);
                    return next;
                  });
                }}
                className="h-4 w-4 cursor-pointer"
              />
              <h3 className="text-lg font-semibold text-main">{file.name}</h3>
              <span className="secondary-soft rounded-md px-2.5 py-1 text-xs font-semibold">
                {file.type}
              </span>
              {file.extractedFromZip ? (
                <span className="badge-tech px-2.5 py-1 text-xs font-semibold">ZIP</span>
              ) : null}
            </div>
            <div className="grid gap-1 text-sm text-soft">
              <p>Original: {file.originalPath || file.originalName}</p>
              <p>Project folder: {file.storedPath}</p>
              {file.folderPath ? <p>Folder: {file.folderPath}</p> : null}
              <p>Size: {file.sizeLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <a
              href={guestDownloadUrl(token, file.id)}
              className="btn btn-ghost btn-sm"
              onClick={(event) => event.stopPropagation()}
            >
              Download
            </a>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedFileId(file.id);
              }}
            >
              Preview
            </button>
          </div>
        </article>
      );
    });
  }

  function renderTree(node: FileTreeNode, depth = 0) {
    if (node.path === "") {
      return (
        <div className="space-y-4">
          {node.files.length ? <div className="space-y-3">{renderFileRows(node.files)}</div> : null}
          {node.children.map((child) => renderTree(child, depth))}
        </div>
      );
    }

    const allNodeFiles = [
      ...node.files,
      ...node.children.flatMap(function flatten(child): PrintFile[] {
        return [...child.files, ...child.children.flatMap(flatten)];
      }),
    ];
    const isCollapsed = collapsedFolders.has(node.path);
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
            ref={(element) => { if (element) element.indeterminate = !allSelected && someSelected; }}
            onChange={(event) => {
              setSelectedFileIds((current) => {
                const next = new Set(current);
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
              setCollapsedFolders((current) => {
                const next = new Set(current);
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
        {!isCollapsed ? <div className="space-y-3 border-t border-[var(--border)] p-3">
          {node.files.length ? renderFileRows(node.files) : null}
          {node.children.map((child) => renderTree(child, depth + 1))}
        </div> : null}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-main md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="panel-technical grid gap-8 p-6 md:p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span className="badge-tech px-3 py-1 text-xs font-semibold">Guest access</span>
              <span className="secondary-soft rounded-full px-3 py-1 text-xs font-semibold">
                This project only
              </span>
              <span className="secondary-soft rounded-full px-3 py-1 text-xs font-semibold">
                {project.license}
              </span>
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-main">{project.title}</h1>
              <p className="mt-4 max-w-3xl text-muted">
                {project.description || "This project was shared via guest link."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  #{tag}
                </span>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="metric-card">
                <p className="text-sm text-soft">Designer</p>
                <p className="mt-2 text-lg font-semibold text-main">{project.author || "-"}</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-soft">Models</p>
                <p className="mt-2 text-lg font-semibold text-main">{modelFiles.length}</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-soft">PDFs</p>
                <p className="mt-2 text-lg font-semibold text-main">{pdfFiles.length}</p>
              </div>
              <div className="metric-card">
                <p className="text-sm text-soft">Updated</p>
                <p className="mt-2 text-sm font-semibold text-main">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                className="btn btn-primary"
                href={guestProjectZipUrl(token)}
              >
                Download project as ZIP
              </a>
              {project.sourceUrl ? (
                <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  Open original
                </a>
              ) : null}
            </div>
          </div>
          <div className="workbench-detail-aside overflow-hidden rounded-xl border border-black/8">
            <ProjectThumbnail project={project} file={thumbnailFile} />
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="space-y-8">
            <ThreeDViewer
              file={selectedFile?.type === "PDF" ? undefined : selectedFile}
              previewLimitMb={150}
              getFileObjectUrlOverride={(file) => guestDownloadUrl(token, file.id, true)}
            />

            <section className="panel space-y-4 p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Project structure</p>
                  <h2 className="mt-2 text-2xl font-bold text-main">Files in project</h2>
                </div>
                <a
                  className="btn btn-secondary btn-sm"
                  href={guestProjectZipUrl(token)}
                >
                  Download all as ZIP
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={selectedFileIds.size === 0}
                  onClick={() => void handleSelectedZipDownload()}
                >
                  Download selection
                </button>
              </div>
              {modelFiles.length ? renderTree(fileTree) : (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--panel-muted)] p-4 text-sm text-muted">
                  No model files available.
                </p>
              )}
            </section>

            <section className="panel space-y-4 p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">PDF</p>
                  <h2 className="mt-2 text-2xl font-bold text-main">Documents</h2>
                </div>
                {selectedPdf ? (
                  <a href={guestDownloadUrl(token, selectedPdf.id)} className="btn btn-secondary btn-sm">
                    Download PDF
                  </a>
                ) : null}
              </div>
              {selectedPdf ? (
                <iframe
                  title={selectedPdf.name}
                  src={guestDownloadUrl(token, selectedPdf.id, true)}
                  className="h-[520px] w-full rounded-xl border border-[var(--border)] bg-white"
                />
              ) : (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--panel-muted)] p-4 text-sm text-muted">
                  No PDF files in this project.
                </p>
              )}
              {pdfFiles.length ? <div className="space-y-3">{renderFileRows(pdfFiles)}</div> : null}
            </section>
          </div>

          <aside className="space-y-8">
            <LicenseSummary license={project.license} />
            <section className="panel space-y-4 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] accent-text">Details</p>
              <div className="grid gap-3 text-sm text-muted">
                <p><strong className="text-main">Source:</strong> {project.sourcePlatform || "-"}</p>
                <p><strong className="text-main">Original:</strong> {project.sourceUrl || "-"}</p>
                <p><strong className="text-main">Created:</strong> {new Date(project.createdAt).toLocaleDateString()}</p>
                <p><strong className="text-main">Files:</strong> {project.files.length}</p>
              </div>
            </section>
          </aside>
        </div>

        <footer className="flex justify-center py-4 text-xs text-muted">
          makershelf guest view
        </footer>
      </div>
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
    </main>
  );
}
