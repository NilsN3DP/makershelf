"use client";

import { useEffect, useState } from "react";

import { BridgeSetupModal } from "@/src/components/layout/bridge-setup-modal";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { type PrintFile, type SlicerApp } from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";

const BRIDGE_KEY = "makershelf-bridge-installed-v2";

const typeStyles: Record<PrintFile["type"], string> = {
  F3D: "secondary-soft",
  STL: "accent-soft",
  OBJ: "secondary-soft",
  "3MF": "accent-soft",
  STEP: "secondary-soft",
  GCODE: "secondary-soft",
  AMF: "secondary-soft",
  PLY: "secondary-soft",
  ZIP: "secondary-soft",
  ARCHIVE: "secondary-soft",
  PDF: "secondary-soft",
};

export function FileCard({
  file,
  isActive,
  isSelected,
  onDelete,
  onSetThumbnail,
  onView,
  onToggleSelect,
}: {
  file: PrintFile;
  isActive?: boolean;
  isSelected?: boolean;
  onDelete: () => void;
  onSetThumbnail: () => void;
  onView: () => void;
  onToggleSelect?: () => void;
}) {
  const { downloadProjectFile, getDesktopOpenTarget, getFileObjectUrl, openDesktopFile, settings } = useMakershelf();
  const [status, setStatus] = useState("");
  const [slicer, setSlicer] = useState<SlicerApp>(settings.preferredSlicer);
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [pendingBridgeOpen, setPendingBridgeOpen] = useState(false);
  const [prusaDockerEnabled, setPrusaDockerEnabled] = useState(false);
  const isPdf = file.type === "PDF";
  const canSendToPrusaDocker = prusaDockerEnabled && ["STL", "3MF", "OBJ", "AMF"].includes(file.type);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const flags = JSON.parse(window.localStorage.getItem("makershelf.dev.flags") || "[]");
        setPrusaDockerEnabled(Array.isArray(flags) && flags.includes("prusa-docker-import"));
      } catch {
        setPrusaDockerEnabled(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const openTarget = isPdf ? undefined : getDesktopOpenTarget(file, slicer);
  const canOpenInSlicer =
    !isPdf && (
      settings.fileAssociations[file.type] === "slicer" ||
      file.type === "3MF" ||
      file.type === "GCODE" ||
      file.type === "STL" ||
      file.type === "OBJ" ||
      file.type === "AMF"
    );
  const canChooseSlicer = false; // always server mode — bridge handles opening

  async function openViaBridge() {
    setStatus(text(settings.language, "Wird geöffnet...", "Opening..."));
    try {
      const response = await fetch("/api/files/download-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Download-Link konnte nicht erstellt werden.");
      }
      const app = slicer === "prusa" ? "prusa" : slicer === "orca" ? "orca" : slicer === "bambu" ? "bambu" : openTarget ?? "bambu";
      const bridgeUrl =
        `makershelf://open?fileUrl=${encodeURIComponent(data.url)}&fileName=${encodeURIComponent(file.name)}&app=${app}`;
      window.location.href = bridgeUrl;
      setStatus(
        text(
          settings.language,
          "Gesendet — Browser-Anfrage bestätigen falls nötig.",
          "Sent — confirm browser prompt if needed.",
        ),
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Fehler beim Öffnen.");
    }
  }

  async function handleOpen() {
    if (isPdf) {
      const url = await getFileObjectUrl(file.id);
      if (url) window.open(url, "_blank");
      else setStatus(text(settings.language, "PDF konnte nicht geladen werden.", "PDF could not be loaded."));
      return;
    }
    const bridgeInstalled =
      typeof window !== "undefined" && localStorage.getItem(BRIDGE_KEY) === "1";
    if (!bridgeInstalled) {
      setPendingBridgeOpen(true);
      setShowBridgeModal(true);
      return;
    }
    await openViaBridge();
  }

  async function handleDownload() {
    const result = await downloadProjectFile(file);
    setStatus(result.message);
  }

  async function handlePrusaDockerImport() {
    setStatus("Kopiere Datei in den PrusaSlicer-Docker-Importordner...");
    try {
      const response = await fetch("/api/dev/prusa-slicer/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });
      const data = (await response.json()) as { message?: string; error?: string; targetPath?: string };
      if (!response.ok) {
        throw new Error(data.error || "PrusaSlicer-Docker-Import fehlgeschlagen.");
      }
      setStatus(data.targetPath ? `${data.message} Ziel: ${data.targetPath}` : data.message || "Datei wurde uebergeben.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "PrusaSlicer-Docker-Import fehlgeschlagen.");
    }
  }

  return (
    <>
    {showBridgeModal && (
      <BridgeSetupModal
        onInstalled={() => {
          localStorage.setItem(BRIDGE_KEY, "1");
          setShowBridgeModal(false);
          if (pendingBridgeOpen) {
            setPendingBridgeOpen(false);
            void openViaBridge();
          }
        }}
        onSkip={() => {
          setShowBridgeModal(false);
          setPendingBridgeOpen(false);
        }}
      />
    )}
    <article
      onClick={onView}
      className={`panel grid cursor-pointer gap-4 rounded-xl p-5 transition md:grid-cols-[1.2fr_0.8fr] ${
        isActive
          ? "border-[var(--primary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_40%,transparent)]"
          : isSelected
            ? "border-[var(--primary)]/60 bg-[color-mix(in_srgb,var(--primary-soft)_40%,transparent)]"
            : "hover:border-[var(--primary)]/50"
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              className="h-4 w-4 cursor-pointer"
            />
          )}
          <h3 className="text-lg font-semibold text-main">{file.name}</h3>
          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${typeStyles[file.type]}`}>
            {file.type}
          </span>
          {file.extractedFromZip ? (
            <span className="badge-tech px-2.5 py-1 text-xs font-semibold">ZIP</span>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted">{file.notes}</p>
        <div className="grid gap-1 text-sm text-soft">
          <p>Original: {file.originalPath || file.originalName}</p>
          <p>Projektordner: {file.storedPath}</p>
          {file.folderPath ? <p>Ordner: {file.folderPath}</p> : null}
          <p>Größe: {file.sizeLabel}</p>
        </div>
      </div>

      <div className="space-y-3">
        {!isPdf && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSetThumbnail();
              }}
              className="btn btn-ghost btn-sm"
            >
              Thumbnail
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              void handleDownload();
            }}
            className="btn btn-ghost btn-sm"
          >
            {text(settings.language, "Download", "Download")}
          </button>
          {canChooseSlicer ? (
            <select
              onClick={(event) => event.stopPropagation()}
              className="input"
              style={{ height: "34px", minWidth: "140px", padding: "0 10px", fontSize: "12px" }}
              value={slicer}
              onChange={(event) => setSlicer(event.target.value as SlicerApp)}
            >
              <option value="prusa">PrusaSlicer</option>
              <option value="orca">OrcaSlicer</option>
              <option value="bambu">Bambu Studio</option>
            </select>
          ) : null}
          {(isPdf || canOpenInSlicer) && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                void handleOpen();
              }}
              className="btn btn-secondary btn-sm"
            >
              {isPdf
                ? text(settings.language, "Im Browser öffnen", "Open in browser")
                : text(settings.language, "Im Slicer öffnen", "Open in slicer")}
            </button>
          )}
          {canSendToPrusaDocker && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                void handlePrusaDockerImport();
              }}
              className="btn btn-secondary btn-sm"
            >
              An PrusaSlicer Docker
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--error, #ef4444)" }}
          >
            {text(settings.language, "Löschen", "Delete")}
          </button>
        </div>

        {status ? (
          <p className="text-xs leading-5 text-muted">{status}</p>
        ) : (
          <p className="text-xs leading-5 text-muted">
            {isPdf
              ? text(settings.language, "PDF wird direkt im Browser geöffnet.", "PDF opens directly in the browser.")
              : text(
                  settings.language,
                  "\"Im Slicer öffnen\" nutzt die makershelf Bridge. Beim ersten Klick öffnet sich die Einrichtung mit Skript-Download.",
                  "\"Open in slicer\" uses makershelf Bridge. On the first click, setup opens with the script download.",
                )}
          </p>
        )}
      </div>
    </article>
    </>
  );
}
