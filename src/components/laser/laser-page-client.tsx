"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { useToast } from "@/src/components/ui/toast";
import type { Language } from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type LaserFile = {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  sizeBytes: string;
  storedPath: string;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type MaterialProfile = {
  id: string;
  name: string;
  material: string;
  laserType: string;
  powerPct: number;
  speedMmMin: number;
  passes: number;
  intervalMm: number | null;
  airAssist: boolean;
  notes: string;
};

type Tab = "library" | "materials";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconLightburn() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v5" />
      <path d="M8 17l4-5 4 5" />
      <path d="M6 21h12" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanBytes(bytes: string | number) {
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeColor(ext: string): string {
  switch (ext.toLowerCase()) {
    case "svg": return "#f97316";
    case "dxf": return "#3b82f6";
    case "plt": return "#8b5cf6";
    case "gcode": return "#10b981";
    default: return "var(--text-muted)";
  }
}

// ─── SVG Preview Modal ────────────────────────────────────────────────────────

function SvgPreviewModal({ file, onClose }: { file: LaserFile; onClose: () => void }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/laser/files/${file.id}/content`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        setSvgContent(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler beim Laden.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [file.id]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--panel)", borderRadius: "12px", width: "min(800px, 100%)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: "14px" }}>{file.name}</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{file.fileType.toUpperCase()} · {humanBytes(file.sizeBytes)}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
          {loading && <p style={{ color: "var(--text-muted)" }}>Wird geladen…</p>}
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          {svgContent && file.fileType === "svg" && (
            <div
              style={{ maxWidth: "100%", maxHeight: "60vh", overflow: "auto", background: "#fff", borderRadius: "8px", padding: "8px" }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
          {svgContent && file.fileType !== "svg" && (
            <pre style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "auto", maxHeight: "400px", background: "var(--panel-muted, #18181f)", padding: "16px", borderRadius: "8px", width: "100%" }}>
              {svgContent.slice(0, 4000)}{svgContent.length > 4000 ? "\n… (truncated)" : ""}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File Upload Area ─────────────────────────────────────────────────────────

function UploadArea({ lang, onUpload }: { lang: Language; onUpload: (file: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        border: `2px dashed ${dragging ? "var(--primary)" : "var(--border)"}`,
        borderRadius: "10px",
        padding: "32px",
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 0.15s",
        background: dragging ? "color-mix(in srgb, var(--primary) 5%, transparent)" : "transparent",
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) void handleFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".svg,.dxf,.plt,.ai,.pdf,.eps,.gcode"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px", color: "var(--text-muted)" }}>
        <IconUpload />
      </div>
      {uploading ? (
        <p style={{ fontSize: "13px", color: "var(--primary)" }}>{text(lang, "Wird hochgeladen…", "Uploading…")}</p>
      ) : (
        <>
          <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
            {text(lang, "Datei hier ablegen oder klicken", "Drop file here or click to browse")}
          </p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>SVG, DXF, PLT, AI, PDF, EPS, GCode · max. 50 MB</p>
        </>
      )}
    </div>
  );
}

// ─── Material Profile Drawer ──────────────────────────────────────────────────

const emptyMaterial = {
  name: "", material: "", laserType: "CO2",
  powerPct: 80, speedMmMin: 500, passes: 1,
  intervalMm: "", airAssist: false, notes: "",
};

type MaterialDrawerMode = "closed" | "add" | "edit";

function MaterialDrawer({
  mode, profile, lang, onClose, onSave,
}: {
  mode: MaterialDrawerMode;
  profile: MaterialProfile | null;
  lang: Language;
  onClose: () => void;
  onSave: (data: typeof emptyMaterial) => Promise<void>;
}) {
  const [form, setForm] = useState(emptyMaterial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "edit" && profile) {
      setForm({
        name: profile.name, material: profile.material, laserType: profile.laserType,
        powerPct: profile.powerPct, speedMmMin: profile.speedMmMin, passes: profile.passes,
        intervalMm: profile.intervalMm?.toString() ?? "",
        airAssist: profile.airAssist, notes: profile.notes,
      });
    } else if (mode === "add") {
      setForm(emptyMaterial);
    }
  }, [mode, profile]);

  if (mode === "closed") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div style={{ width: "min(440px, 100vw)", background: "var(--panel)", borderLeft: "1px solid var(--border)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700 }}>
            {mode === "add" ? text(lang, "Profil erstellen", "Create Profile") : text(lang, "Profil bearbeiten", "Edit Profile")}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ padding: "20px 24px", flex: 1 }}>
          {[
            { label: text(lang, "Profilname *", "Profile Name *"), key: "name" as const, placeholder: text(lang, "z.B. Sperrholz 3mm Schneiden", "e.g. Plywood 3mm Cut") },
            { label: text(lang, "Material *", "Material *"), key: "material" as const, placeholder: text(lang, "z.B. Sperrholz", "e.g. Plywood") },
            { label: text(lang, "Laser-Typ", "Laser Type"), key: "laserType" as const, placeholder: "CO2, Diode, Fiber…" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>{label}</label>
              <input className="input" value={form[key] as string} placeholder={placeholder} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            {[
              { label: text(lang, "Leistung %", "Power %"), key: "powerPct" as const, min: 0, max: 100 },
              { label: text(lang, "Speed mm/min", "Speed mm/min"), key: "speedMmMin" as const, min: 1, max: 100000 },
              { label: text(lang, "Durchgänge", "Passes"), key: "passes" as const, min: 1, max: 50 },
            ].map(({ label, key, min, max }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>{label}</label>
                <input
                  className="input"
                  type="number"
                  min={min}
                  max={max}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
              {text(lang, "Linienabstand mm", "Line interval mm")} <span style={{ fontWeight: 400 }}>{text(lang, "(optional)", "(optional)")}</span>
            </label>
            <input className="input" type="number" min="0.01" max="100" step="0.01" value={form.intervalMm} onChange={(e) => setForm((f) => ({ ...f, intervalMm: e.target.value }))} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", cursor: "pointer" }}>
            <input type="checkbox" checked={form.airAssist} onChange={(e) => setForm((f) => ({ ...f, airAssist: e.target.checked }))} />
            <span style={{ fontSize: "13px" }}>{text(lang, "Luftunterstützung", "Air Assist")}</span>
          </label>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>{text(lang, "Notizen", "Notes")}</label>
            <textarea className="input" rows={2} style={{ resize: "vertical" }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim() || !form.material.trim()}>
              {saving ? "…" : text(lang, "Speichern", "Save")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>{text(lang, "Abbrechen", "Cancel")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LaserPageClient({ deviceType = "laser" }: { deviceType?: "laser" | "plotter" }) {
  const { settings } = useMakershelf();
  const { toast } = useToast();
  const lang = settings.language;

  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [files, setFiles] = useState<LaserFile[]>([]);
  const [materials, setMaterials] = useState<MaterialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<LaserFile | null>(null);
  const [materialDrawerMode, setMaterialDrawerMode] = useState<MaterialDrawerMode>("closed");
  const [editingProfile, setEditingProfile] = useState<MaterialProfile | null>(null);
  const [tagFilter, setTagFilter] = useState("");

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/laser/files?deviceType=${deviceType}`, { cache: "no-store" });
      const data = await res.json() as { files?: LaserFile[] };
      setFiles(data.files ?? []);
    } catch {
      toast(text(lang, "Dateien konnten nicht geladen werden.", "Could not load files."), "error");
    }
  }, [lang, toast, deviceType]);

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch(`/api/laser/materials?deviceType=${deviceType}`, { cache: "no-store" });
      const data = await res.json() as { materials?: MaterialProfile[] };
      setMaterials(data.materials ?? []);
    } catch {
      toast(text(lang, "Profile konnten nicht geladen werden.", "Could not load profiles."), "error");
    }
  }, [lang, toast, deviceType]);

  useEffect(() => {
    async function loadAll() {
      await Promise.all([loadFiles(), loadMaterials()]);
      setLoading(false);
    }
    void loadAll();
  }, [loadFiles, loadMaterials]);

  async function handleUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tags", "[]");
    fd.append("deviceType", deviceType);
    try {
      const res = await fetch("/api/laser/files", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Upload fehlgeschlagen.");
      }
      await loadFiles();
      toast(text(lang, "Datei hochgeladen.", "File uploaded."), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload fehlgeschlagen.", "error");
    }
  }

  async function handleDeleteFile(id: string) {
    if (!window.confirm(text(lang, "Datei wirklich löschen?", "Delete this file?"))) return;
    try {
      const res = await fetch(`/api/laser/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen.");
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast(text(lang, "Datei gelöscht.", "File deleted."), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Fehler.", "error");
    }
  }

  async function handleSaveMaterial(data: typeof emptyMaterial) {
    const payload = {
      name: data.name, material: data.material, laserType: data.laserType,
      powerPct: Number(data.powerPct), speedMmMin: Number(data.speedMmMin),
      passes: Number(data.passes),
      intervalMm: data.intervalMm ? Number(data.intervalMm) : null,
      airAssist: data.airAssist, notes: data.notes,
    };
    try {
      if (materialDrawerMode === "add") {
        const res = await fetch("/api/laser/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Fehler beim Anlegen.");
        await loadMaterials();
        toast(text(lang, "Profil erstellt.", "Profile created."), "success");
      } else if (editingProfile) {
        const res = await fetch(`/api/laser/materials/${editingProfile.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Fehler beim Speichern.");
        await loadMaterials();
        toast(text(lang, "Gespeichert.", "Saved."), "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Fehler.", "error");
      throw err;
    }
  }

  async function handleDeleteMaterial(id: string) {
    if (!window.confirm(text(lang, "Profil wirklich löschen?", "Delete this profile?"))) return;
    try {
      const res = await fetch(`/api/laser/materials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen.");
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      toast(text(lang, "Profil gelöscht.", "Profile deleted."), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Fehler.", "error");
    }
  }

  function openInLightburn(file: LaserFile) {
    const bridge = settings.lightburnBridgeUrl?.trim().replace(/\/$/, "");
    if (!bridge) {
      toast(text(lang, "Lightburn Bridge URL nicht konfiguriert. Bitte in den Einstellungen hinterlegen.", "Lightburn Bridge URL not configured. Please set it in Settings."), "error");
      return;
    }
    const fileUrl = `${window.location.origin}/api/laser/files/${file.id}/content`;
    window.open(`${bridge}/open?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(file.name)}`, "_blank");
  }

  // Computed
  const allTags = [...new Set(files.flatMap((f) => f.tags))].sort();
  const filteredFiles = files.filter((f) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || f.name.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q)) || f.fileType.toLowerCase().includes(q);
    const matchesTag = !tagFilter || f.tags.includes(tagFilter);
    return matchesSearch && matchesTag;
  });

  const groupedMaterials = materials.reduce<Record<string, MaterialProfile[]>>((acc, m) => {
    (acc[m.material] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {deviceType === "plotter"
              ? text(lang, "Plotter", "Plotter")
              : text(lang, "Laser", "Laser")}
          </h1>
          <p className="page-subtitle">
            {deviceType === "plotter"
              ? text(lang, "Datei-Bibliothek für PLT/DXF/HPGL & Materialprofile", "File library for PLT/DXF/HPGL & material profiles")
              : text(lang, "Datei-Bibliothek, Vorschau & Materialprofile", "File library, preview & material profiles")}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar-line" style={{ marginBottom: "1.5rem" }}>
        {[
          { id: "library" as const, label: text(lang, "Bibliothek", "Library") },
          { id: "materials" as const, label: text(lang, "Materialprofile", "Material Profiles") },
        ].map((tab) => (
          <button key={tab.id} type="button" className={`tab-btn-line${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
            {tab.id === "library" && files.length > 0 && <span className="badge badge-neutral" style={{ marginLeft: "6px" }}>{files.length}</span>}
            {tab.id === "materials" && materials.length > 0 && <span className="badge badge-neutral" style={{ marginLeft: "6px" }}>{materials.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>
          {text(lang, "Wird geladen…", "Loading…")}
        </div>
      ) : (
        <>
          {/* ── Library Tab ─────────────────────────────────────────── */}
          {activeTab === "library" && (
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "16px", alignItems: "start" }}>
              {/* Sidebar */}
              <div>
                <UploadArea lang={lang} onUpload={handleUpload} />

                {allTags.length > 0 && (
                  <div className="panel" style={{ marginTop: "12px", padding: "14px 16px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                      {text(lang, "Tags", "Tags")}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-sm${!tagFilter ? " active" : ""}`}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                        onClick={() => setTagFilter("")}
                      >
                        {text(lang, "Alle", "All")}
                      </button>
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={`btn btn-ghost btn-sm${tagFilter === tag ? " active" : ""}`}
                          style={{ fontSize: "11px", padding: "2px 8px" }}
                          onClick={() => setTagFilter(tag === tagFilter ? "" : tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* File list */}
              <div>
                <div style={{ marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder={text(lang, "Dateien suchen…", "Search files…")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {filteredFiles.length} {text(lang, "Dateien", "files")}
                  </span>
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="panel panel-padded" style={{ textAlign: "center", padding: "48px 24px" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>📁</div>
                    <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
                      {files.length === 0
                        ? text(lang, "Noch keine Dateien", "No files yet")
                        : text(lang, "Keine Treffer", "No results")}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {files.length === 0
                        ? text(lang, "Lade deine erste SVG oder DXF-Datei hoch.", "Upload your first SVG or DXF file.")
                        : text(lang, "Andere Suchbegriffe versuchen.", "Try different search terms.")}
                    </p>
                  </div>
                ) : (
                  <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                    {filteredFiles.map((file, i) => (
                      <div
                        key={file.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          borderBottom: i < filteredFiles.length - 1 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        {/* Type badge */}
                        <div style={{
                          width: 38, height: 38, borderRadius: "8px",
                          background: `color-mix(in srgb, ${fileTypeColor(file.fileType)} 15%, transparent)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: fileTypeColor(file.fileType), textTransform: "uppercase" }}>
                            {file.fileType}
                          </span>
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: "13.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</p>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "2px" }}>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{humanBytes(file.sizeBytes)}</span>
                            {file.tags.map((tag) => (
                              <span key={tag} style={{ fontSize: "10px", background: "var(--panel-muted, #18181f)", borderRadius: "4px", padding: "1px 6px", color: "var(--text-muted)" }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          {(file.fileType === "svg" || file.fileType === "dxf" || file.fileType === "gcode") && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title={text(lang, "Vorschau", "Preview")}
                              onClick={() => setPreviewFile(file)}
                            >
                              <IconEye />
                            </button>
                          )}
                          <a
                            href={`/api/laser/files/${file.id}/content`}
                            download={file.name}
                            className="btn btn-ghost btn-sm"
                            title={text(lang, "Herunterladen", "Download")}
                          >
                            <IconDownload />
                          </a>
                          {settings.lightburnBridgeUrl && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="In Lightburn öffnen"
                              onClick={() => openInLightburn(file)}
                            >
                              <IconLightburn />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--danger)" }}
                            title={text(lang, "Löschen", "Delete")}
                            onClick={() => void handleDeleteFile(file.id)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Materials Tab ────────────────────────────────────────── */}
          {activeTab === "materials" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  onClick={() => { setEditingProfile(null); setMaterialDrawerMode("add"); }}
                >
                  <IconPlus />
                  {text(lang, "Neues Profil", "New Profile")}
                </button>
              </div>

              {materials.length === 0 ? (
                <div className="panel panel-padded" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚙️</div>
                  <p style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
                    {text(lang, "Noch keine Materialprofile", "No material profiles yet")}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
                    {text(lang, "Speichere Leistung, Speed und Durchgänge pro Material.", "Save power, speed and passes per material.")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => { setEditingProfile(null); setMaterialDrawerMode("add"); }}
                  >
                    {text(lang, "Erstes Profil erstellen", "Create first profile")}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {Object.entries(groupedMaterials).map(([material, profiles]) => (
                    <div key={material}>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>{material}</p>
                      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                        {profiles.map((profile, i) => (
                          <div
                            key={profile.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "16px",
                              padding: "12px 16px",
                              borderBottom: i < profiles.length - 1 ? "1px solid var(--border)" : "none",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: "13.5px" }}>{profile.name}</p>
                              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{profile.laserType}</p>
                            </div>
                            {[
                              { label: text(lang, "Leistung", "Power"), value: `${profile.powerPct}%` },
                              { label: text(lang, "Speed", "Speed"), value: `${profile.speedMmMin} mm/min` },
                              { label: text(lang, "Durchg.", "Passes"), value: String(profile.passes) },
                              ...(profile.intervalMm ? [{ label: "Interval", value: `${profile.intervalMm} mm` }] : []),
                              ...(profile.airAssist ? [{ label: text(lang, "Luft", "Air"), value: "✓" }] : []),
                            ].map(({ label, value }) => (
                              <div key={label} style={{ textAlign: "center", minWidth: "60px" }}>
                                <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>{label}</p>
                                <p style={{ fontSize: "13px", fontWeight: 600 }}>{value}</p>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => { setEditingProfile(profile); setMaterialDrawerMode("edit"); }}
                              >
                                <IconEdit />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: "var(--danger)" }}
                                onClick={() => void handleDeleteMaterial(profile.id)}
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* SVG Preview Modal */}
      {previewFile && (
        <SvgPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* Material Profile Drawer */}
      <MaterialDrawer
        mode={materialDrawerMode}
        profile={editingProfile}
        lang={lang}
        onClose={() => setMaterialDrawerMode("closed")}
        onSave={handleSaveMaterial}
      />
    </div>
  );
}
