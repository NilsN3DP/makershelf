"use client";

import { useEffect, useRef, useState } from "react";

import { ThemePanel } from "@/src/components/settings/theme-panel";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { useToast } from "@/src/components/ui/toast";
import { text } from "@/src/lib/locale";
import { getRuntimeConfig } from "@/src/lib/runtime-config";
import { needsFixedStoragePath } from "@/src/lib/storage-paths";

const pageSizeOptions = [12, 24, 48, 96] as const;
const previewSizeOptions = [50, 150, 250, 500] as const;

type UpdatePayload = {
  currentVersion?: string; latestVersion?: string; updateAvailable?: boolean;
  releaseName?: string; releaseUrl?: string; assetName?: string;
  canInstall?: boolean; message?: string; error?: string;
};

type LicensePayload = {
  tier?: "community" | "commercial";
  state?: "active" | "needs-check" | "unconfigured" | "invalid";
  nextCheckAt?: string;
  lastCheckAt?: string;
  licenseServerUrl?: string;
  instanceId?: string;
  keyConfigured?: boolean;
  message?: string;
  error?: string;
};

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(fallbackMessage);
  try { return JSON.parse(raw) as T; } catch { throw new Error(fallbackMessage); }
}

type Tab = "general" | "license" | "appearance" | "storage" | "integrations" | "categories" | "creators" | "data" | "advanced";

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <p className="settings-row-title">{title}</p>
        {desc && <p className="settings-row-desc">{desc}</p>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export function SettingsPageClient() {
  const {
    settings, categories, creators, projects,
    updateSettings, createCategory, deleteCategory,
    createCreator, updateCreator, deleteCreator,
    exportTransferBundle, importTransferBundle,
    resetApplication, hardResetApplication,
  } = useMakershelf();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryEmoji, setCategoryEmoji] = useState("📁");
  const [categoryColor, setCategoryColor] = useState(settings.primaryColor);
  const [creatorName, setCreatorName] = useState("");
  const [creatorFolders, setCreatorFolders] = useState("");
  const [editingCreatorId, setEditingCreatorId] = useState("");
  const [editingCreatorName, setEditingCreatorName] = useState("");
  const [editingCreatorFolders, setEditingCreatorFolders] = useState("");
  const [pickerStatus, setPickerStatus] = useState("");
  const [pickerErrors, setPickerErrors] = useState<string[]>([]);
  const [resetStatus, setResetStatus] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [transferStatus, setTransferStatus] = useState("");
  const [transferPending, setTransferPending] = useState(false);
  const [hardResetStatus, setHardResetStatus] = useState("");
  const [hardResetPending, setHardResetPending] = useState(false);
  const [pickerPending, setPickerPending] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateInfo, setUpdateInfo] = useState<UpdatePayload | null>(null);
  const [licensePending, setLicensePending] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicensePayload | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseMessage, setLicenseMessage] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [hardResetConfirm, setHardResetConfirm] = useState(false);
  const [appNameDraft, setAppNameDraft] = useState(settings.appName);
  const [multiUserPending, setMultiUserPending] = useState(false);
  const transferInputRef = useRef<HTMLInputElement | null>(null);

  const fileAssociationOptions = [
    { value: "slicer", label: text(settings.language, "Bevorzugter Slicer", "Preferred slicer") },
    { value: "prusa", label: "PrusaSlicer" },
    { value: "orca", label: "OrcaSlicer" },
    { value: "bambu", label: "Bambu Studio" },
    { value: "fusion360", label: "Fusion 360" },
    { value: "freecad", label: "FreeCAD" },
  ] as const;

  const runtimeConfig = getRuntimeConfig();
  const isFilesystemStorageActive = settings.storageDriver === "filesystem";
  const serverStorageRoot = runtimeConfig.storageRoot || "/storage";
  const serverImportRoot = runtimeConfig.importRoot || "/import";
  const effectiveStoragePath = serverStorageRoot;
  const storedFilesCount = projects.reduce((sum, project) => sum + project.files.length, 0);

  async function saveWorkspaceName() {
    const trimmed = appNameDraft.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/system/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern.");
      await updateSettings({ appName: trimmed });
      toast(text(settings.language, "Gespeichert.", "Saved."), "success");
    } catch {
      toast(text(settings.language, "Fehler beim Speichern.", "Failed to save."), "error");
    }
  }

  async function updateFilamentSettings(input: Partial<typeof settings>) {
    const response = await fetch("/api/filament/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as Partial<typeof settings> & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Filament-Einstellungen konnten nicht gespeichert werden.");
    await updateSettings(payload);
  }

  const visibleCategories = categories.filter((c) =>
    `${c.name} ${c.description}`.toLowerCase().includes(categoryFilter.trim().toLowerCase()),
  );
  const visibleCreators = creators.filter((c) =>
    `${c.name} ${c.folders.map((f) => f.name).join(" ")}`.toLowerCase().includes(creatorFilter.trim().toLowerCase()),
  );

  async function refreshLicenseStatus() {
    setLicensePending(true);
    try {
      const response = await fetch("/api/license/status", { cache: "no-store" });
      const payload = await readJsonResponse<LicensePayload>(response, "Lizenzstatus konnte nicht geladen werden.");
      if (!response.ok) throw new Error(payload.error || "Lizenzstatus konnte nicht geladen werden.");
      setLicenseStatus(payload);
      setLicenseMessage(payload.message || "");
    } catch (err) {
      setLicenseMessage(err instanceof Error ? err.message : "Lizenzstatus konnte nicht geladen werden.");
    } finally {
      setLicensePending(false);
    }
  }

  async function handleActivateLicense() {
    setLicensePending(true);
    setLicenseMessage(text(settings.language, "Lizenz wird geprüft...", "Checking license..."));
    try {
      const response = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ licenseKey }),
      });
      const payload = await readJsonResponse<LicensePayload & { ok?: boolean }>(response, "Lizenz konnte nicht aktiviert werden.");
      if (!response.ok) throw new Error(payload.error || payload.message || "Lizenz konnte nicht aktiviert werden.");
      setLicenseStatus(payload);
      setLicenseMessage(payload.message || "Lizenz wurde geprüft.");
    } catch (err) {
      setLicenseMessage(err instanceof Error ? err.message : "Lizenz konnte nicht aktiviert werden.");
    } finally {
      setLicensePending(false);
    }
  }

  useEffect(() => {
    if (activeTab === "license" && !licenseStatus && !licensePending) {
      void refreshLicenseStatus();
    }
  }, [activeTab, licensePending, licenseStatus]);

  async function handleCheckForUpdate() {
    setUpdatePending(true);
    setUpdateStatus(text(settings.language, "GitHub Release wird geprüft...", "Checking GitHub release..."));
    try {
      const response = await fetch("/api/system/update", { cache: "no-store" });
      const payload = await readJsonResponse<UpdatePayload>(response, "Update konnte nicht geprüft werden.");
      if (!response.ok) throw new Error(payload.error || "Update konnte nicht geprüft werden.");
      setUpdateInfo(payload);
      setUpdateStatus(payload.updateAvailable
        ? text(settings.language, `Update verfügbar: ${payload.latestVersion}.`, `Update available: ${payload.latestVersion}.`)
        : text(settings.language, `Aktuell auf Version ${payload.currentVersion}.`, `You are on version ${payload.currentVersion}.`));
    } catch (err) {
      setUpdateStatus(err instanceof Error ? err.message : text(settings.language, "Update konnte nicht geprüft werden.", "Update check failed."));
    } finally { setUpdatePending(false); }
  }

  async function handleInstallLatestUpdate() {
    setUpdatePending(true);
    setUpdateStatus(text(settings.language, "Update wird heruntergeladen...", "Downloading update..."));
    try {
      const response = await fetch("/api/system/update", { method: "POST", cache: "no-store" });
      const payload = await readJsonResponse<UpdatePayload>(response, "Update konnte nicht installiert werden.");
      if (!response.ok) throw new Error(payload.error || "Update konnte nicht installiert werden.");
      setUpdateInfo(payload);
      setUpdateStatus(payload.message || text(settings.language, "Update wurde gestartet.", "Update launched."));
    } catch (err) {
      setUpdateStatus(err instanceof Error ? err.message : text(settings.language, "Update konnte nicht installiert werden.", "Update install failed."));
    } finally { setUpdatePending(false); }
  }

  async function handleStorageFolderPick() {
    try {
      setPickerPending(true); setPickerErrors([]);
      setPickerStatus(text(settings.language, "Windows-Ordnerdialog wird geöffnet...", "Opening Windows folder dialog..."));
      const response = await fetch("/api/system/pick-folder", { method: "POST", cache: "no-store" });
      const payload = await readJsonResponse<{ sessionId?: string; error?: string }>(response, "Ordnerauswahl konnte nicht gestartet werden.");
      if (!response.ok) throw new Error(payload.error || "Ordnerauswahl ist hier nicht verfügbar.");
      if (!payload.sessionId) throw new Error("Ordnerauswahl konnte nicht gestartet werden.");

      while (true) {
        await new Promise((r) => window.setTimeout(r, 450));
        const pollResponse = await fetch(`/api/system/pick-folder?sessionId=${encodeURIComponent(payload.sessionId)}`, { cache: "no-store" });
        const pollPayload = await readJsonResponse<{ state?: "pending" | "selected" | "canceled" | "error"; path?: string; error?: string }>(pollResponse, "Ordnerauswahl konnte nicht gelesen werden.");
        if (!pollResponse.ok) throw new Error(pollPayload.error || "Ordnerauswahl konnte nicht gelesen werden.");
        if (pollPayload.state === "pending") continue;
        if (pollPayload.state === "canceled" || !pollPayload.path) { setPickerStatus(""); return; }
        if (pollPayload.state === "error") throw new Error(pollPayload.error || "Ordnerauswahl ist fehlgeschlagen.");

        const nextPath = pollPayload.path.trim();
        const currentPath = settings.storagePath.trim();
        if (nextPath !== currentPath || storedFilesCount > 0) {
          const confirmed = window.confirm(text(settings.language,
            `Projektordner wechseln?\n\nAktuell: ${currentPath || "Nicht gesetzt"}\nNeu: ${nextPath}\nBetroffene Dateien: ${storedFilesCount}\n\nVorhandene Dateien werden kopiert.`,
            `Change project folder?\n\nCurrent: ${currentPath || "Not set"}\nNew: ${nextPath}\nAffected files: ${storedFilesCount}\n\nExisting files will be copied.`,
          ));
          if (!confirmed) { setPickerStatus(text(settings.language, "Abgebrochen.", "Canceled.")); return; }
        }
        setPickerStatus(text(settings.language, `Ordner "${nextPath}" wird übernommen...`, `Migrating to "${nextPath}"...`));
        await updateSettings({ storagePath: nextPath, storageMode: "custom-path", storageDriver: "filesystem" });
        setPickerStatus(text(settings.language, `Pfad auf "${nextPath}" gesetzt.`, `Path set to "${nextPath}".`));
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const lines = message.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const safe = message.includes("Unexpected end") || message.includes("execute 'json'") ? "Speicherpfad konnte nicht aktualisiert werden." : lines[0] || message;
      setPickerErrors(lines.slice(1));
      setPickerStatus(text(settings.language, safe || "Ordnerauswahl nicht verfügbar.", safe || "Folder picker not available."));
    } finally { setPickerPending(false); }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: text(settings.language, "Allgemein", "General") },
    { id: "license", label: text(settings.language, "Lizenz", "License") },
    { id: "appearance", label: text(settings.language, "Darstellung", "Appearance") },
    { id: "storage", label: text(settings.language, "Speicher", "Storage") },
    { id: "integrations", label: text(settings.language, "Integrationen", "Integrations") },
    { id: "categories", label: text(settings.language, "Kategorien", "Categories") },
    { id: "creators", label: text(settings.language, "Ersteller", "Creators") },
    { id: "data", label: text(settings.language, "Daten", "Data") },
    { id: "advanced", label: text(settings.language, "Erweitert", "Advanced") },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(settings.language, "Einstellungen", "Settings")}</h1>
          <p className="page-subtitle">
            {text(settings.language, "Server-Edition · Workspace & System", "Server edition · Workspace & System")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <a href="/team" className="btn btn-secondary btn-sm">{text(settings.language, "Benutzer verwalten", "Manage users")}</a>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar-line" style={{ marginBottom: "1.75rem" }}>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={`tab-btn-line${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── General ─────────────────────────────────────────────────── */}
      {activeTab === "general" && (
        <div className="panel">
          <div className="panel-section">
            <Row title={text(settings.language, "Workspace-Name", "Workspace name")} desc={text(settings.language, "Wird oben links in der Navigation und im Ladesplash angezeigt.", "Shown in the top-left navigation and on the loading splash.")}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input className="input" style={{ width: 200 }} value={appNameDraft} onChange={(e) => setAppNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveWorkspaceName(); }} />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveWorkspaceName()}>{text(settings.language, "Speichern", "Save")}</button>
              </div>
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Sprache", "Language")}>
              <select className="input select" style={{ width: 180 }} value={settings.language} onChange={(e) => updateSettings({ language: e.target.value as typeof settings.language })}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="it">Italiano</option>
                <option value="nl">Nederlands</option>
              </select>
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Bevorzugter Slicer", "Preferred slicer")} desc={text(settings.language, "Standardprogramm zum Öffnen von STL/3MF-Dateien.", "Default program for opening STL/3MF files.")}>
              <select className="input select" style={{ width: 180 }} value={settings.preferredSlicer} onChange={(e) => updateSettings({ preferredSlicer: e.target.value as "prusa" | "orca" | "bambu" })}>
                <option value="prusa">PrusaSlicer</option>
                <option value="orca">OrcaSlicer</option>
                <option value="bambu">Bambu Studio</option>
              </select>
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Projekte pro Seite", "Projects per page")}>
              <select className="input select" style={{ width: 100 }} value={String(settings.pageSize)} onChange={(e) => updateSettings({ pageSize: Number(e.target.value) })}>
                {pageSizeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Dashboard-Projekte", "Dashboard projects")} desc={text(settings.language, "Anzahl der zuletzt aktualisierten Projekte auf der Übersicht.", "Number of recently updated projects on the overview.")}>
              <input className="input" style={{ width: 100 }} type="number" min={3} max={24} value={settings.dashboardFeaturedCount} onChange={(e) => updateSettings({ dashboardFeaturedCount: Number(e.target.value) || 6 })} />
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Preview-Limit (MB)", "Preview limit (MB)")} desc={text(settings.language, "Dateien über diesem Limit werden nicht vorschaubar.", "Files over this limit won't be previewed.")}>
              <select className="input select" style={{ width: 100 }} value={String(settings.maxPreviewFileSizeMb)} onChange={(e) => updateSettings({ maxPreviewFileSizeMb: Number(e.target.value) })}>
                {previewSizeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Row>
          </div>
          <div className="panel-section">
            <Row
              title={text(settings.language, "Mehrbenutzermodus", "Multi-user mode")}
              desc={text(
                settings.language,
                "Aktiviert Einladungen, Rollen und Benutzer-Verwaltung.",
                "Enables invitations, roles and user management.",
              )}
            >
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.multiUserEnabled ?? false}
                  disabled={multiUserPending}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setMultiUserPending(true);
                    try {
                      const res = await fetch("/api/system/multi-user", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ multiUserEnabled: val }),
                      });
                      if (!res.ok) throw new Error("Fehler.");
                      await updateSettings({ multiUserEnabled: val });
                    } catch {
                      // revert is handled by settings not updating
                    } finally {
                      setMultiUserPending(false);
                    }
                  }}
                />
                <span className="toggle-track" />
              </label>
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Debug-Modus", "Debug mode")}>
              <label className="toggle">
                <input type="checkbox" checked={settings.debugMode} onChange={(e) => updateSettings({ debugMode: e.target.checked })} />
                <span className="toggle-track" />
              </label>
            </Row>
          </div>

          {/* Product info */}
          <div className="panel-section">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {[
                { label: text(settings.language, "Produkt", "Product"), value: "Server" },
                { label: text(settings.language, "Datenhaltung", "Data mode"), value: settings.dataBackend.toUpperCase() },
                { label: text(settings.language, "Storage-Treiber", "Storage driver"), value: settings.storageDriver },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "12px", background: "var(--panel-muted)", borderRadius: "8px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-soft)", marginBottom: "4px" }}>{label}</p>
                  <p style={{ fontSize: "14px", fontWeight: 600 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── License ────────────────────────────────────────────────── */}
      {activeTab === "license" && (
        <div className="panel">
          <div className="panel-section">
            <Row
              title={text(settings.language, "Lizenzstatus", "License status")}
              desc={text(
                settings.language,
                "Community wird spätestens alle sechs Monate erneut geprüft. Commercial nutzt den konfigurierten Lizenzserver.",
                "Community is rechecked at least every six months. Commercial uses the configured license server.",
              )}
            >
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refreshLicenseStatus()} disabled={licensePending}>
                {licensePending ? text(settings.language, "Prüft...", "Checking...") : text(settings.language, "Status prüfen", "Check status")}
              </button>
            </Row>
          </div>
          <div className="panel-section">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
              {[
                { label: text(settings.language, "Typ", "Tier"), value: licenseStatus?.tier ?? "community" },
                { label: text(settings.language, "Status", "Status"), value: licenseStatus?.state ?? "unbekannt" },
                { label: text(settings.language, "Nächste Prüfung", "Next check"), value: licenseStatus?.nextCheckAt ? new Date(licenseStatus.nextCheckAt).toLocaleDateString("de-DE") : "-" },
                { label: text(settings.language, "Lizenzserver", "License server"), value: licenseStatus?.licenseServerUrl || text(settings.language, "Nicht gesetzt", "Not set") },
              ].map((item) => (
                <div key={item.label} style={{ padding: "12px", borderRadius: "10px", background: "var(--panel-muted)" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-soft)" }}>{item.label}</p>
                  <p style={{ marginTop: "5px", fontWeight: 700, wordBreak: "break-word" }}>{item.value}</p>
                </div>
              ))}
            </div>
            {licenseMessage && <p style={{ marginTop: "12px", color: "var(--text-muted)", fontSize: "13px" }}>{licenseMessage}</p>}
          </div>
          <div className="panel-section">
            <Row
              title={text(settings.language, "Lizenz aktivieren", "Activate license")}
              desc={text(
                settings.language,
                "Trage einen Community- oder Commercial-Key ein. Persistente Keys werden über Docker/Unraid-Variablen gesetzt.",
                "Enter a Community or Commercial key. Persistent keys are configured through Docker/Unraid variables.",
              )}
            >
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <input
                  className="input"
                  style={{ width: "min(420px, 100%)" }}
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="MAKERSHELF-COMMUNITY-..."
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleActivateLicense()} disabled={licensePending || licenseKey.trim().length < 8}>
                  {text(settings.language, "Aktivieren", "Activate")}
                </button>
              </div>
            </Row>
          </div>
        </div>
      )}

      {/* ── Appearance ──────────────────────────────────────────────── */}
      {activeTab === "appearance" && (
        <div>
          <div className="panel" style={{ marginBottom: "16px" }}>
            <div className="panel-section">
              <Row title={text(settings.language, "Theme", "Theme")} desc={text(settings.language, "Hell, dunkel oder Systemeinstellung.", "Light, dark or follow system.")}>
                <select className="input select" style={{ width: 180 }} value={settings.themeMode} onChange={(e) => updateSettings({ themeMode: e.target.value as "system" | "light" | "dark" })}>
                  <option value="system">{text(settings.language, "System", "System")}</option>
                  <option value="light">{text(settings.language, "Hell", "Light")}</option>
                  <option value="dark">{text(settings.language, "Dunkel", "Dark")}</option>
                </select>
              </Row>
            </div>
          </div>
          <ThemePanel />
        </div>
      )}

      {/* ── Storage ─────────────────────────────────────────────────── */}
      {activeTab === "storage" && (
        <div className="panel">
          <div className="panel-section">
            <p style={{ fontWeight: 700, marginBottom: "4px" }}>
              {text(settings.language, "Server-Speicherpfad", "Server storage path")}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "1rem" }}>
              {text(settings.language, "Projektdateien werden serverseitig im konfigurierten Volume abgelegt.", "Project files are stored server-side in the configured volume.")}
            </p>

            <input
              className="input"
              value={serverStorageRoot}
              readOnly
              style={{ cursor: "default", marginBottom: "10px" }}
              disabled
            />

            <div style={{ marginTop: "12px", padding: "12px", background: "var(--panel-muted)", borderRadius: "8px", fontSize: "13px" }}>
              <p>{text(settings.language, "Aktiver Zielpfad:", "Current path:")} <strong>{effectiveStoragePath}</strong></p>
              <p style={{ marginTop: "4px" }}>{text(settings.language, "Speicherlogik:", "Storage:")} <strong>{isFilesystemStorageActive ? "Filesystem" : settings.storageDriver}</strong></p>
              <p style={{ marginTop: "4px" }}>{text(settings.language, "Importordner:", "Import folder:")} <strong>{serverImportRoot}</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* ── Integrations ───────────────────────────────────────────── */}
      {activeTab === "integrations" && (
        <div className="panel">
          <div className="panel-section">
            <Row
              title="Filament Vault"
              desc={text(
                settings.language,
                "Eigenes Filament-Dashboard mit Pro-Person-Bestand, Team Share, Ort je Spule und OpenPrintTag-Vorbereitung.",
                "Native filament dashboard with per-person stock, team share, location per spool and OpenPrintTag preparation.",
              )}
            >
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.filamentVaultEnabled}
                  onChange={(e) => {
                    void updateFilamentSettings({ filamentVaultEnabled: e.target.checked }).catch((error) => toast(error instanceof Error ? error.message : "Filament-Einstellungen konnten nicht gespeichert werden.", "error"));
                  }}
                />
                <span className="toggle-track" />
              </label>
            </Row>
          </div>
          <div className="panel-section">
            <Row title="OpenPrintTag" desc="NFC/iPhone-Workflow wird vorbereitet, aktuell als kopierbarer Tag-Payload.">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.filamentOpenPrintTagEnabled}
                  onChange={(e) => {
                    void updateFilamentSettings({ filamentOpenPrintTagEnabled: e.target.checked }).catch((error) => toast(error instanceof Error ? error.message : "Filament-Einstellungen konnten nicht gespeichert werden.", "error"));
                  }}
                />
                <span className="toggle-track" />
              </label>
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Tag-Basis-URL", "Tag base URL")} desc={text(settings.language, "Optional für spätere Tag-/QR-Links. Leer nutzt die aktuelle makershelf-Adresse.", "Optional for future tag/QR links. Empty uses the current makershelf address.")}>
              <input
                className="input"
                style={{ width: "min(520px, 100%)" }}
                value={settings.filamentTagBaseUrl}
                onChange={(e) => {
                  void updateFilamentSettings({ filamentTagBaseUrl: e.target.value }).catch((error) => toast(error instanceof Error ? error.message : "Filament-Einstellungen konnten nicht gespeichert werden.", "error"));
                }}
                placeholder="https://makershelf.pache.local"
              />
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Schwellwerte", "Thresholds")}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "min(520px, 100%)" }}>
                <input
                  className="input"
                  type="number"
                  value={settings.filamentLowThresholdGrams}
                  onChange={(e) => void updateFilamentSettings({ filamentLowThresholdGrams: Number(e.target.value) }).catch((error) => toast(error instanceof Error ? error.message : "Filament-Einstellungen konnten nicht gespeichert werden.", "error"))}
                  placeholder="Low g"
                />
                <input
                  className="input"
                  type="number"
                  value={settings.filamentDefaultTareGrams}
                  onChange={(e) => void updateFilamentSettings({ filamentDefaultTareGrams: Number(e.target.value) }).catch((error) => toast(error instanceof Error ? error.message : "Filament-Einstellungen konnten nicht gespeichert werden.", "error"))}
                  placeholder="Tara g"
                />
              </div>
            </Row>
          </div>
          <div className="panel-section" style={{ borderTop: "1px solid var(--border)", marginTop: "8px", paddingTop: "18px" }}>
            <Row
              title="Prusa Link"
              desc={text(settings.language, "Lokale Verbindung zu deinem Prusa-Drucker. Ermöglicht Filamentverbrauch-Tracking.", "Local connection to your Prusa printer. Enables filament usage tracking.")}
            >
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.prusaLinkEnabled ?? false}
                  onChange={(e) => updateSettings({ prusaLinkEnabled: e.target.checked })}
                />
                <span className="toggle-track" />
              </label>
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Prusa Link URL", "Prusa Link URL")} desc={text(settings.language, "IP-Adresse deines Druckers im lokalen Netzwerk.", "IP address of your printer on the local network.")}>
              <input
                className="input"
                style={{ width: "min(520px, 100%)" }}
                value={settings.prusaLinkUrl ?? ""}
                onChange={(e) => updateSettings({ prusaLinkUrl: e.target.value })}
                placeholder="http://192.168.1.100"
              />
            </Row>
          </div>
          <div className="panel-section">
            <Row title={text(settings.language, "Prusa Link API-Key", "Prusa Link API key")} desc={text(settings.language, "Aus den Drucker-Einstellungen unter PrusaLink.", "Found in the printer settings under PrusaLink.")}>
              <input
                className="input"
                type="password"
                style={{ width: "min(520px, 100%)" }}
                value={settings.prusaLinkApiKey ?? ""}
                onChange={(e) => updateSettings({ prusaLinkApiKey: e.target.value })}
                placeholder={text(settings.language, "Leer lassen wenn nicht gesetzt", "Leave empty if not set")}
              />
            </Row>
          </div>

          {/* ── Drucker Farm ── */}
          <div className="panel-section">
            <Row
              title={text(settings.language, "Drucker Farm", "Printer Farm")}
              desc={text(
                settings.language,
                "Verwalte mehrere 3D-Drucker in einer Übersicht. Statusanzeige, Webcam-Vorschau und Jobverlauf.",
                "Manage multiple 3D printers in one dashboard. Status, webcam preview, and job history.",
              )}
            >
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.printerFarmEnabled ?? false}
                  onChange={(e) => updateSettings({ printerFarmEnabled: e.target.checked })}
                />
                <span className="toggle-track" />
              </label>
            </Row>
          </div>

          {/* ── 3D Print Tools ── */}
          <div className="panel-section">
            <Row
              title={text(settings.language, "3D-Druck Tools", "3D Print Tools")}
              desc={text(
                settings.language,
                "STL-Dateien in STEP AP242 Tessellated konvertieren.",
                "Convert STL files to STEP AP242 tessellated.",
              )}
            >
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.printToolsEnabled ?? false}
                  onChange={(e) => updateSettings({ printToolsEnabled: e.target.checked })}
                />
                <span className="toggle-track" />
              </label>
            </Row>
          </div>

        </div>
      )}

      {/* ── Categories ──────────────────────────────────────────────── */}
      {activeTab === "categories" && (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "16px", alignItems: "start" }}>
          <div className="panel panel-padded">
            <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "1rem" }}>
              {text(settings.language, "Neue Kategorie", "New category")}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); void createCategory({ name: categoryName, description: categoryDescription, emoji: categoryEmoji, color: categoryColor }); setCategoryName(""); setCategoryDescription(""); setCategoryEmoji("📁"); setCategoryColor(settings.primaryColor); }}>
              <div className="input"><input className="input" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder={text(settings.language, "Kategoriename", "Category name")} required /></div>
              <div className="input"><input className="input" value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} placeholder={text(settings.language, "Beschreibung", "Description")} required /></div>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "8px" }} className="input">
                <input className="input" value={categoryEmoji} onChange={(e) => setCategoryEmoji(e.target.value)} placeholder="📁" />
                <input type="color" className="input" value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} style={{ height: "38px", padding: "3px 6px", cursor: "pointer" }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                {text(settings.language, "Anlegen", "Create")}
              </button>
            </form>
          </div>

          <div className="panel">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontWeight: 700, fontSize: "13.5px" }}>{text(settings.language, "Kategorien", "Categories")}</p>
              <span className="badge badge-neutral">{categories.length}</span>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <input className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder={text(settings.language, "Suchen...", "Search...")} />
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {visibleCategories.map((cat) => (
                <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "18px" }}>{cat.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "13.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{cat.description}</p>
                  </div>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: cat.color, border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
                  <button type="button" onClick={() => void deleteCategory(cat.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>
                    {text(settings.language, "Entfernen", "Remove")}
                  </button>
                </div>
              ))}
              {visibleCategories.length === 0 && (
                <p style={{ padding: "16px", fontSize: "13px", color: "var(--text-muted)" }}>{text(settings.language, "Keine Kategorien gefunden.", "No categories found.")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Creators ────────────────────────────────────────────────── */}
      {activeTab === "creators" && (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "16px", alignItems: "start" }}>
          <div className="panel panel-padded">
            <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "1rem" }}>
              {text(settings.language, "Neuer Creator", "New creator")}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); void createCreator({ name: creatorName, folders: creatorFolders.split(",") }); setCreatorName(""); setCreatorFolders(""); }}>
              <div className="input"><input className="input" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder={text(settings.language, "Creator-Name", "Creator name")} required /></div>
              <div className="input"><input className="input" value={creatorFolders} onChange={(e) => setCreatorFolders(e.target.value)} placeholder={text(settings.language, "Unterordner (komma-getrennt)", "Subfolders (comma-separated)")} /></div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                {text(settings.language, "Anlegen", "Create")}
              </button>
            </form>
          </div>

          <div className="panel">
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontWeight: 700, fontSize: "13.5px" }}>Creators</p>
              <span className="badge badge-neutral">{creators.length}</span>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <input className="input" value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)} placeholder={text(settings.language, "Suchen...", "Search...")} />
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {visibleCreators.map((creator) => (
                <div key={creator.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "13.5px" }}>{creator.name}</p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {creator.folders.length > 0 ? creator.folders.map((f) => f.name).join(", ") : text(settings.language, "Keine Unterordner", "No subfolders")}
                      </p>
                    </div>
                    <button type="button" onClick={() => { setEditingCreatorId(creator.id); setEditingCreatorName(creator.name); setEditingCreatorFolders(creator.folders.map((f) => f.name).join(", ")); }} className="btn btn-ghost btn-sm">
                      {text(settings.language, "Bearbeiten", "Edit")}
                    </button>
                    <button type="button" onClick={() => void deleteCreator(creator.id)} className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>
                      {text(settings.language, "Entfernen", "Remove")}
                    </button>
                  </div>
                  {editingCreatorId === creator.id && (
                    <div style={{ padding: "12px 16px 14px", background: "var(--panel-muted)", display: "grid", gap: "8px" }}>
                      <input className="input" value={editingCreatorName} onChange={(e) => setEditingCreatorName(e.target.value)} placeholder={text(settings.language, "Creator-Name", "Creator name")} />
                      <input className="input" value={editingCreatorFolders} onChange={(e) => setEditingCreatorFolders(e.target.value)} placeholder={text(settings.language, "Unterordner, komma-getrennt", "Subfolders, comma-separated")} />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button type="button" onClick={async () => { await updateCreator(creator.id, { name: editingCreatorName, folders: editingCreatorFolders.split(",") }); setEditingCreatorId(""); setEditingCreatorName(""); setEditingCreatorFolders(""); }} className="btn btn-primary btn-sm">
                          {text(settings.language, "Speichern", "Save")}
                        </button>
                        <button type="button" onClick={() => { setEditingCreatorId(""); setEditingCreatorName(""); setEditingCreatorFolders(""); }} className="btn btn-ghost btn-sm">
                          {text(settings.language, "Abbrechen", "Cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {visibleCreators.length === 0 && (
                <p style={{ padding: "16px", fontSize: "13px", color: "var(--text-muted)" }}>{text(settings.language, "Keine Creators gefunden.", "No creators found.")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Data ────────────────────────────────────────────────────── */}
      {activeTab === "data" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <>
              <div className="panel panel-padded">
                <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>{text(settings.language, "Transfer", "Transfer")}</p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
                  {text(settings.language, "Exportiert alle Projekte, Dateien, Kategorien, Creators und Listen als Paket. Kann in Single- oder Server-Version importiert werden.", "Exports all projects, files, categories, creators and lists as a package. Can be imported into Single or Server edition.")}
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" onClick={async () => { setTransferPending(true); setTransferStatus(""); try { await exportTransferBundle(); setTransferStatus(text(settings.language, "Transferdatei erstellt.", "Transfer package created.")); } catch (err) { setTransferStatus(err instanceof Error ? err.message : text(settings.language, "Export fehlgeschlagen.", "Export failed.")); } finally { setTransferPending(false); } }} className="btn btn-secondary" disabled={transferPending}>
                    {transferPending ? text(settings.language, "Exportiert...", "Exporting...") : text(settings.language, "Exportieren", "Export")}
                  </button>
                  <button type="button" onClick={() => transferInputRef.current?.click()} className="btn btn-primary" disabled={transferPending}>
                    {transferPending ? text(settings.language, "Importiert...", "Importing...") : text(settings.language, "Importieren", "Import")}
                  </button>
                  <input ref={transferInputRef} type="file" accept=".zip,application/zip" className="hidden" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void (async () => { setTransferPending(true); setTransferStatus(""); try { await importTransferBundle(file); setTransferStatus(text(settings.language, "Transfer importiert.", "Transfer imported.")); } catch (err) { setTransferStatus(err instanceof Error ? err.message : text(settings.language, "Import fehlgeschlagen.", "Import failed.")); } finally { e.target.value = ""; setTransferPending(false); } })(); }} />
                </div>
                {transferStatus && <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>{transferStatus}</p>}
              </div>

              <div className="panel panel-padded" style={{ border: "1px solid var(--border)" }}>
                <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px", color: "var(--danger)" }}>{text(settings.language, "Gefährliche Aktionen", "Danger zone")}</p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
                  {text(settings.language, "Diese Aktionen sind nicht rückgängig zu machen.", "These actions cannot be undone.")}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", padding: "12px", background: "var(--panel-muted)", borderRadius: "8px" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "13.5px" }}>{text(settings.language, "Ersteinrichtung zurücksetzen", "Reset onboarding")}</p>
                      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>{text(settings.language, "Lokale Einstellungen und Browser-Daten zurücksetzen.", "Reset local settings and browser data.")}</p>
                    </div>
                    {resetConfirm ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button type="button" className="btn btn-danger btn-sm" disabled={resetPending} onClick={async () => { setResetPending(true); setResetStatus(""); try { await resetApplication(); } catch (err) { setResetStatus(err instanceof Error ? err.message : text(settings.language, "Reset fehlgeschlagen.", "Reset failed.")); } finally { setResetPending(false); setResetConfirm(false); } }}>
                          {resetPending ? text(settings.language, "Läuft...", "Running...") : text(settings.language, "Ja, zurücksetzen", "Yes, reset")}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResetConfirm(false)}>{text(settings.language, "Abbrechen", "Cancel")}</button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setResetConfirm(true)}>{text(settings.language, "Zurücksetzen", "Reset")}</button>
                    )}
                  </div>
                  {resetStatus && <p style={{ fontSize: "13px", color: "var(--danger)" }}>{resetStatus}</p>}

                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", padding: "12px", background: "var(--danger-soft)", borderRadius: "8px", border: "1px solid var(--danger)" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--danger)" }}>{text(settings.language, "Werksreset", "Factory reset")}</p>
                      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>{text(settings.language, "Löscht alle Projekte, Dateien, Kategorien und die Ersteinrichtung vollständig.", "Deletes all projects, files, categories and the onboarding state completely.")}</p>
                    </div>
                    {hardResetConfirm ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button type="button" className="btn btn-danger btn-sm" disabled={hardResetPending} onClick={async () => { setHardResetPending(true); setHardResetStatus(""); try { await hardResetApplication(); } catch (err) { setHardResetStatus(err instanceof Error ? err.message : text(settings.language, "Werksreset fehlgeschlagen.", "Factory reset failed.")); } finally { setHardResetPending(false); setHardResetConfirm(false); } }}>
                          {hardResetPending ? text(settings.language, "Läuft...", "Running...") : text(settings.language, "Ja, alles löschen", "Yes, delete all")}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHardResetConfirm(false)}>{text(settings.language, "Abbrechen", "Cancel")}</button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setHardResetConfirm(true)}>{text(settings.language, "Alles löschen", "Delete all")}</button>
                    )}
                  </div>
                  {hardResetStatus && <p style={{ fontSize: "13px", color: "var(--danger)" }}>{hardResetStatus}</p>}
                </div>
              </div>
            </>
        </div>
      )}

      {/* ── Advanced ────────────────────────────────────────────────── */}
      {activeTab === "advanced" && (
        <div className="panel panel-padded">
          <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "1rem" }}>{text(settings.language, "Dateizuordnungen", "File associations")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px", marginBottom: "1.5rem" }}>
            {(["F3D", "STL", "OBJ", "3MF", "STEP", "GCODE", "AMF", "PLY", "ZIP", "ARCHIVE"] as const).map((type) => (
              <div key={type} className="input">
                <label className="label">{type}</label>
                <select className="input select" value={settings.fileAssociations[type]} onChange={(e) => updateSettings({ fileAssociations: { ...settings.fileAssociations, [type]: e.target.value } })}>
                  {fileAssociationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            {text(settings.language, "Slicer-Pfade", "Slicer paths")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {([
              { label: "PrusaSlicer EXE", val: settings.slicerExePaths.prusa, ph: "C:\\Program Files\\Prusa3D\\PrusaSlicer\\PrusaSlicer.exe", onChange: (v: string) => updateSettings({ slicerExePaths: { ...settings.slicerExePaths, prusa: v } }) },
              { label: "OrcaSlicer EXE", val: settings.slicerExePaths.orca, ph: "C:\\Program Files\\OrcaSlicer\\OrcaSlicer.exe", onChange: (v: string) => updateSettings({ slicerExePaths: { ...settings.slicerExePaths, orca: v } }) },
              { label: "Bambu Studio EXE", val: settings.slicerExePaths.bambu, ph: "C:\\Program Files\\Bambu Studio\\BambuStudio.exe", onChange: (v: string) => updateSettings({ slicerExePaths: { ...settings.slicerExePaths, bambu: v } }) },
              { label: "Fusion 360 EXE", val: settings.fusion360ExePath, ph: "C:\\Program Files\\Autodesk\\Fusion 360\\Fusion360.exe", onChange: (v: string) => updateSettings({ fusion360ExePath: v }) },
            ]).map(({ label, val, ph, onChange }) => (
              <div key={label} className="input">
                <label className="label">{label}</label>
                <input className="input" value={val} onChange={(e) => onChange(e.target.value)} placeholder={ph} />
              </div>
            ))}
          </div>
          <div className="input" style={{ marginTop: "10px" }}>
            <label className="label">FreeCAD EXE</label>
            <input className="input" value={settings.freecadExePath} onChange={(e) => updateSettings({ freecadExePath: e.target.value })} placeholder={"C:\\Program Files\\FreeCAD 1.0\\bin\\FreeCAD.exe"} />
          </div>

          <p style={{ marginTop: "1.5rem", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            {text(settings.language, "Hinweis: Je nach Plattform können Website-Daten oder Medien nur eingeschränkt verfügbar sein.", "Note: Depending on the platform, website data or media may be available only in a limited way.")}
          </p>
        </div>
      )}
    </div>
  );
}
