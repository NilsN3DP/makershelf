"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import type { Language } from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiType = "prusa-link" | "moonraker" | "octoprint";

type PrinterGroup = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  _count?: { printers: number };
};

type Printer = {
  id: string;
  name: string;
  model: string | null;
  location: string | null;
  groupId: string | null;
  group: { id: string; name: string; color: string } | null;
  apiType: ApiType;
  apiUrl: string;
  apiKey: string | null;
  webcamUrl: string | null;
  active: boolean;
  sortOrder: number;
  tags: string[];
  notes: string;
  lastJobName: string;
  lastJobAt: string | null;
};

type PrinterStatus = {
  ok: boolean;
  connected: boolean;
  state: string | null;
  progress: number | null;
  jobName: string | null;
  filamentUsedMm: number | null;
  filamentUsedG: number | null;
  timeRemainingS: number | null;
  timePrintingS: number | null;
  bedTempC: number | null;
  nozzleTempC: number | null;
  error?: string;
};

type MaintenanceLog = {
  id: string;
  type: string;
  notes: string;
  performedAt: string;
};

type FilamentLog = {
  id: string;
  materialName: string;
  colorName: string;
  gramsUsed: number;
  jobName: string;
  spoolId: string | null;
  notes: string;
  loggedAt: string;
};

type FilamentSpool = {
  id: string;
  name: string;
  manufacturer: string | null;
  material: string;
  colorName: string | null;
  colorHex: string | null;
  remainingWeightGrams: number | null;
  openPrintTagId: string | null;
};

type ActiveDetail = "status" | "maintenance" | "filament";

type DiscoveredPrinter = {
  name: string;
  host: string;
  ip: string;
  port: number;
  apiType: ApiType;
  apiUrl: string;
};

const MAINTENANCE_TYPES = [
  { id: "cleaning", de: "Reinigung", en: "Cleaning", emoji: "🧹" },
  { id: "filament_change", de: "Filamentwechsel", en: "Filament Change", emoji: "🔄" },
  { id: "calibration", de: "Kalibrierung", en: "Calibration", emoji: "📐" },
  { id: "nozzle_change", de: "Düsenwechsel", en: "Nozzle Change", emoji: "🔩" },
  { id: "bed_leveling", de: "Bett-Leveling", en: "Bed Leveling", emoji: "⬜" },
  { id: "lubrication", de: "Schmierung", en: "Lubrication", emoji: "🛢️" },
  { id: "firmware_update", de: "Firmware-Update", en: "Firmware Update", emoji: "💾" },
  { id: "repair", de: "Reparatur", en: "Repair", emoji: "🔧" },
  { id: "other", de: "Sonstiges", en: "Other", emoji: "📝" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTemp(v: number | null): string {
  return v != null ? `${Math.round(v)}°C` : "–";
}

function stateColor(state: string | null, connected: boolean): string {
  if (!connected) return "var(--text-muted)";
  const s = (state ?? "").toLowerCase();
  if (s === "printing") return "var(--primary)";
  if (s === "paused") return "#f59e0b";
  if (s === "finished" || s === "operational" || s === "idle" || s === "ready") return "#22c55e";
  if (s.includes("error") || s.includes("offline")) return "var(--danger)";
  return "var(--text-muted)";
}

function stateLabel(state: string | null, connected: boolean, lang: Language): string {
  if (!connected) return text(lang, "Offline", "Offline");
  if (!state) return text(lang, "Unbekannt", "Unknown");
  const map: Record<string, [string, string]> = {
    printing: ["Druckt", "Printing"],
    paused: ["Pausiert", "Paused"],
    finished: ["Fertig", "Finished"],
    operational: ["Bereit", "Ready"],
    idle: ["Bereit", "Ready"],
    ready: ["Bereit", "Ready"],
    cancelling: ["Abbricht…", "Cancelling…"],
    error: ["Fehler", "Error"],
  };
  const lower = state.toLowerCase();
  for (const [k, [de, en]] of Object.entries(map)) {
    if (lower.includes(k)) return text(lang, de, en);
  }
  return state;
}

function maintenanceLabel(type: string, lang: Language): string {
  const t = MAINTENANCE_TYPES.find((m) => m.id === type);
  if (!t) return type;
  return `${t.emoji} ${text(lang, t.de, t.en)}`;
}

function relativeDate(iso: string, lang: Language): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return text(lang, "Heute", "Today");
  if (d === 1) return text(lang, "Gestern", "Yesterday");
  if (d < 7) return text(lang, `vor ${d} Tagen`, `${d} days ago`);
  return new Date(iso).toLocaleDateString(lang === "de" ? "de-DE" : "en-US");
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconEdit() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function IconTrash() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
function IconNfc() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12.5C5 8.36 8.36 5 12.5 5"/><path d="M8 12.5C8 10.015 10.015 8 12.5 8"/><circle cx="12.5" cy="12.5" r="1.5" fill="currentColor" stroke="none"/><path d="M20 12.5C20 16.64 16.64 20 12.5 20"/><path d="M17 12.5C17 14.985 14.985 17 12.5 17"/></svg>;
}
function IconRefresh() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>;
}
function IconX() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconSearch() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function IconDownload() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function IconUpload() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function IconPause() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
}
function IconPlay() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function IconStop() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
}

// ─── Control Button ───────────────────────────────────────────────────────────

function ControlButton({ printerId, action, lang, onDone, danger, children }: {
  printerId: string;
  action: "pause" | "resume" | "stop";
  lang: Language;
  onDone: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (action === "stop" && !confirm(text(lang, "Druck wirklich abbrechen?", "Really cancel print?"))) return;
    setBusy(true);
    await fetch(`/api/printer-farm/printers/${printerId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    onDone();
    setBusy(false);
  }

  return (
    <button
      type="button"
      className="btn btn-sm"
      style={danger
        ? { background: "color-mix(in srgb, var(--danger) 15%, var(--panel))", color: "var(--danger)", border: "1px solid var(--danger)" }
        : { background: "color-mix(in srgb, var(--primary) 15%, var(--panel))", color: "var(--primary)", border: "1px solid var(--primary)" }}
      disabled={busy}
      onClick={() => void run()}
    >
      {children}
    </button>
  );
}

// ─── Printer Drawer (Add/Edit) ────────────────────────────────────────────────

function PrinterDrawer({ lang, printer, groups, onClose, onSaved }: {
  lang: Language;
  printer: Printer | null;
  groups: PrinterGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(printer?.name ?? "");
  const [model, setModel] = useState(printer?.model ?? "");
  const [location, setLocation] = useState(printer?.location ?? "");
  const [groupId, setGroupId] = useState(printer?.groupId ?? "");
  const [apiType, setApiType] = useState<ApiType>(printer?.apiType ?? "prusa-link");
  const [apiUrl, setApiUrl] = useState(printer?.apiUrl ?? "");
  const [apiKey, setApiKey] = useState(printer?.apiKey ?? "");
  const [webcamUrl, setWebcamUrl] = useState(printer?.webcamUrl ?? "");
  const [tagsInput, setTagsInput] = useState((printer?.tags ?? []).join(", "));
  const [notes, setNotes] = useState(printer?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim() || !apiUrl.trim()) return;
    setSaving(true);
    setError("");
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const body = {
      name: name.trim(), model: model.trim() || null, location: location.trim() || null,
      groupId: groupId || null, apiType, apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim() || null, webcamUrl: webcamUrl.trim() || null,
      tags, notes: notes.trim(),
    };
    const url = printer ? `/api/printer-farm/printers/${printer.id}` : "/api/printer-farm/printers";
    const method = printer ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      setError(j.error ?? "Fehler beim Speichern.");
    } else {
      onSaved();
    }
    setSaving(false);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(480px, 100vw)", height: "100dvh", background: "var(--panel)", borderLeft: "1px solid var(--border)", overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontWeight: 700, fontSize: "16px" }}>
            {printer ? text(lang, "Drucker bearbeiten", "Edit Printer") : text(lang, "Drucker hinzufügen", "Add Printer")}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><IconX /></button>
        </div>

        {([
          { label: text(lang, "Name *", "Name *"), value: name, set: setName, placeholder: "MK4S", type: "text" },
          { label: text(lang, "Modell", "Model"), value: model, set: setModel, placeholder: "Prusa MK4S", type: "text" },
          { label: text(lang, "Standort", "Location"), value: location, set: setLocation, placeholder: text(lang, "Werkstatt, OG, Regal…", "Workshop, Upstairs…"), type: "text" },
        ] as const).map(({ label, value, set, placeholder, type }) => (
          <div key={label}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{label}</label>
            <input className="input" style={{ width: "100%" }} type={type} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
          </div>
        ))}

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>
            {text(lang, "Gruppe", "Group")}
          </label>
          <select className="input" style={{ width: "100%" }} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">{text(lang, "Keine Gruppe", "No group")}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>API</label>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["prusa-link", "moonraker", "octoprint"] as ApiType[]).map((t) => (
              <button key={t} type="button" className={`btn btn-sm${apiType === t ? " btn-primary" : " btn-ghost"}`} onClick={() => setApiType(t)}>
                {t === "prusa-link" ? "PrusaLink" : t === "moonraker" ? "Moonraker" : "OctoPrint"}
              </button>
            ))}
          </div>
        </div>

        {([
          { label: "API URL *", value: apiUrl, set: setApiUrl, placeholder: "http://192.168.1.100", type: "url" },
          { label: "API Key", value: apiKey, set: setApiKey, placeholder: text(lang, "Leer lassen wenn nicht benötigt", "Leave empty if not needed"), type: "password" },
          { label: text(lang, "Webcam URL", "Webcam URL"), value: webcamUrl, set: setWebcamUrl, placeholder: "http://192.168.1.100/webcam", type: "url" },
        ] as const).map(({ label, value, set, placeholder, type }) => (
          <div key={label}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{label}</label>
            <input className="input" style={{ width: "100%" }} type={type} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
          </div>
        ))}

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>
            {text(lang, "Tags (kommagetrennt)", "Tags (comma-separated)")}
          </label>
          <input className="input" style={{ width: "100%" }} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="PLA, Werkstatt, Hauptdrucker" />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>
            {text(lang, "Notizen", "Notes")}
          </label>
          <textarea className="input" style={{ width: "100%", resize: "vertical" }} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p style={{ fontSize: "12.5px", color: "var(--danger)" }}>⚠ {error}</p>}

        <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "8px" }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{text(lang, "Abbrechen", "Cancel")}</button>
          <button type="button" className="btn btn-primary" style={{ flex: 2 }} disabled={!name.trim() || !apiUrl.trim() || saving} onClick={() => void save()}>
            {saving ? text(lang, "Speichert…", "Saving…") : text(lang, "Speichern", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Drawer ─────────────────────────────────────────────────────────────

function GroupDrawer({ lang, group, onClose, onSaved }: {
  lang: Language;
  group: PrinterGroup | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [color, setColor] = useState(group?.color ?? "#6366f1");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const url = group ? `/api/printer-farm/groups/${group.id}` : "/api/printer-farm/groups";
    const method = group ? "PATCH" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), color }) });
    onSaved();
    setSaving(false);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", width: "min(400px, 95vw)", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h3 style={{ fontWeight: 700, fontSize: "15px" }}>
          {group ? text(lang, "Gruppe bearbeiten", "Edit Group") : text(lang, "Gruppe erstellen", "Create Group")}
        </h3>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Name", "Name")}</label>
          <input className="input" style={{ width: "100%" }} value={name} onChange={(e) => setName(e.target.value)} placeholder={text(lang, "z.B. Werkstatt", "e.g. Workshop")} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Farbe", "Color")}</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: "40px", height: "36px", borderRadius: "6px", cursor: "pointer", border: "1px solid var(--border)", padding: "2px" }} />
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{color}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{text(lang, "Abbrechen", "Cancel")}</button>
          <button type="button" className="btn btn-primary" style={{ flex: 2 }} disabled={!name.trim() || saving} onClick={() => void save()}>
            {saving ? "…" : text(lang, "Speichern", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Discovery Modal ──────────────────────────────────────────────────────────

function DiscoveryModal({ lang, onClose, onAdded }: {
  lang: Language;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [scanning, setScanning] = useState(true);
  const [printers, setPrinters] = useState<DiscoveredPrinter[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/printer-farm/discover");
        const data = await res.json().catch(() => ({})) as { printers?: DiscoveredPrinter[]; error?: string };
        if (!res.ok) {
          setScanError(data.error ?? text(lang, "Scan fehlgeschlagen.", "Scan failed."));
          return;
        }
        const discovered = Array.isArray(data.printers) ? data.printers : [];
        setPrinters(discovered);
        setSelected(new Set(discovered.map((_, i) => i)));
        if (data.error && discovered.length > 0) setScanError(data.error);
      } catch (error) {
        setScanError(error instanceof Error ? error.message : text(lang, "Scan fehlgeschlagen.", "Scan failed."));
      } finally {
        setScanning(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function addSelected() {
    setAdding(true);
    const toAdd = printers.filter((_, i) => selected.has(i));
    for (const p of toAdd) {
      await fetch("/api/printer-farm/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, apiType: p.apiType, apiUrl: p.apiUrl }),
      });
    }
    onAdded();
  }

  function apiLabel(t: ApiType) {
    return t === "prusa-link" ? "PrusaLink" : t === "moonraker" ? "Moonraker" : "OctoPrint";
  }
  function apiColor(t: ApiType) {
    return t === "prusa-link" ? "#f97316" : t === "moonraker" ? "#6366f1" : "#22c55e";
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`@keyframes pf-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", width: "min(600px, 96vw)", maxHeight: "80dvh", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: "16px", margin: 0 }}>
              {text(lang, "Netzwerk-Scan", "Network Scan")}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              PrusaLink · Moonraker · OctoPrint
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><IconX /></button>
        </div>

        {scanning ? (
          <div style={{ textAlign: "center", padding: "36px 20px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "pf-spin 0.75s linear infinite", margin: "0 auto 14px" }} />
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              {text(lang, "Scannt Netzwerk nach Druckern…", "Scanning network for printers…")}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "5px" }}>
              {text(lang, "Dauert ca. 5 Sekunden.", "Takes about 5 seconds.")}
            </p>
          </div>
        ) : scanError && printers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 20px" }}>
            <p style={{ fontSize: "28px", marginBottom: "10px" }}>⚠️</p>
            <p style={{ fontWeight: 600, marginBottom: "6px" }}>{text(lang, "Scan-Fehler", "Scan error")}</p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{scanError}</p>
          </div>
        ) : printers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 20px" }}>
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</p>
            <p style={{ fontWeight: 600, marginBottom: "6px" }}>{text(lang, "Keine Drucker gefunden", "No printers found")}</p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "380px", margin: "0 auto" }}>
              {text(lang,
                "Stelle sicher, dass die Drucker im gleichen Netzwerk sind und PrusaLink/Moonraker/OctoPrint aktiviert ist.",
                "Make sure printers are on the same network with PrusaLink/Moonraker/OctoPrint enabled.")}
            </p>
            {scanError ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>{scanError}</p>
            ) : null}
          </div>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
              {printers.length} {text(lang, "Drucker gefunden. Wähle aus, welche hinzugefügt werden sollen:", "printers found. Select which to add:")}
            </p>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              {printers.map((p, i) => (
                <label
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "11px 14px", borderRadius: "8px", cursor: "pointer",
                    border: `1px solid ${selected.has(i) ? "color-mix(in srgb, var(--primary) 40%, var(--border))" : "var(--border)"}`,
                    background: selected.has(i) ? "color-mix(in srgb, var(--primary) 6%, var(--panel))" : "var(--panel)",
                  }}
                >
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "1px 7px", borderRadius: "20px", background: `color-mix(in srgb, ${apiColor(p.apiType)} 15%, transparent)`, color: apiColor(p.apiType), flexShrink: 0 }}>
                        {apiLabel(p.apiType)}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "13.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{p.apiUrl}</p>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={adding}>
                {text(lang, "Abbrechen", "Cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={selected.size === 0 || adding}
                onClick={() => void addSelected()}
              >
                {adding
                  ? text(lang, "Fügt hinzu…", "Adding…")
                  : text(lang, `${selected.size} Drucker hinzufügen`, `Add ${selected.size} printer${selected.size !== 1 ? "s" : ""}`)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Printer Detail Panel ─────────────────────────────────────────────────────

function PrinterDetailPanel({ lang, printer, status, onClose, onEdit, onStatusRefresh }: {
  lang: Language;
  printer: Printer;
  status: PrinterStatus | null;
  onClose: () => void;
  onEdit: () => void;
  onStatusRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ActiveDetail>("status");

  // Maintenance state
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [maintType, setMaintType] = useState("cleaning");
  const [maintNotes, setMaintNotes] = useState("");
  const [maintDate, setMaintDate] = useState(new Date().toISOString().slice(0, 16));
  const [savingMaint, setSavingMaint] = useState(false);

  // Filament state
  const [filamentLogs, setFilamentLogs] = useState<FilamentLog[]>([]);
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [spoolId, setSpoolId] = useState("");
  const [grams, setGrams] = useState("");
  const [jobName, setJobName] = useState("");
  const [matName, setMatName] = useState("");
  const [colName, setColName] = useState("");
  const [deductFromSpool, setDeductFromSpool] = useState(true);
  const [filNotes, setFilNotes] = useState("");
  const [savingFil, setSavingFil] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);

  const fetchMaintenance = useCallback(async () => {
    const res = await fetch(`/api/printer-farm/printers/${printer.id}/maintenance`);
    if (res.ok) setMaintenanceLogs(await res.json() as MaintenanceLog[]);
  }, [printer.id]);

  const fetchFilamentLogs = useCallback(async () => {
    const res = await fetch(`/api/printer-farm/printers/${printer.id}/filament-log`);
    if (res.ok) setFilamentLogs(await res.json() as FilamentLog[]);
  }, [printer.id]);

  const fetchSpools = useCallback(async () => {
    const res = await fetch("/api/filament/spools?status=ACTIVE&limit=200");
    if (res.ok) {
      const data = await res.json() as { spools?: FilamentSpool[] };
      setSpools(data.spools ?? []);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "maintenance") void fetchMaintenance();
    if (activeTab === "filament") { void fetchFilamentLogs(); void fetchSpools(); }
  }, [activeTab, fetchMaintenance, fetchFilamentLogs, fetchSpools]);

  // Auto-fill material/color from selected spool
  useEffect(() => {
    if (!spoolId) return;
    const s = spools.find((sp) => sp.id === spoolId);
    if (s) { setMatName(s.material ?? ""); setColName(s.colorName ?? ""); }
  }, [spoolId, spools]);

  async function addMaintenance() {
    setSavingMaint(true);
    await fetch(`/api/printer-farm/printers/${printer.id}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: maintType, notes: maintNotes, performedAt: new Date(maintDate).toISOString() }),
    });
    setMaintNotes("");
    await fetchMaintenance();
    setSavingMaint(false);
  }

  async function deleteMaintenance(logId: string) {
    await fetch(`/api/printer-farm/printers/${printer.id}/maintenance?logId=${logId}`, { method: "DELETE" });
    setMaintenanceLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  async function addFilamentLog() {
    if (!grams || Number(grams) <= 0) return;
    setSavingFil(true);
    await fetch(`/api/printer-farm/printers/${printer.id}/filament-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spoolId: spoolId || null, gramsUsed: Number(grams),
        materialName: matName, colorName: colName,
        jobName, notes: filNotes,
        deductFromSpool: spoolId ? deductFromSpool : false,
      }),
    });
    setGrams(""); setJobName(""); setFilNotes(""); setSpoolId("");
    await fetchFilamentLogs();
    setSavingFil(false);
  }

  async function deleteFilamentLog(logId: string) {
    await fetch(`/api/printer-farm/printers/${printer.id}/filament-log?logId=${logId}`, { method: "DELETE" });
    setFilamentLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  async function scanNfc() {
    if (!("NDEFReader" in window)) {
      alert(text(lang, "Web NFC wird nur in Chrome auf Android unterstützt.", "Web NFC is only supported in Chrome on Android."));
      return;
    }
    setNfcScanning(true);
    try {
      // @ts-expect-error NDEFReader not in standard TS lib
      const reader = new window.NDEFReader() as { scan: () => Promise<void>; onreading: ((e: { message: { records: Array<{ recordType: string; data: DataView }> } }) => void) | null };
      await reader.scan();
      reader.onreading = (evt) => {
        for (const record of evt.message.records) {
          if (record.recordType === "text") {
            const tagText = new TextDecoder().decode(record.data);
            const found = spools.find((s) => s.openPrintTagId === tagText || s.id === tagText);
            if (found) { setSpoolId(found.id); setNfcScanning(false); return; }
          }
        }
        alert(text(lang, "Keine passende Spule gefunden.", "No matching spool found."));
        setNfcScanning(false);
      };
    } catch {
      setNfcScanning(false);
    }
  }

  const totalGrams = filamentLogs.reduce((s, l) => s + l.gramsUsed, 0);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(600px, 100vw)", height: "100dvh", background: "var(--panel)", borderLeft: "1px solid var(--border)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 0", borderBottom: "1px solid var(--border)", paddingBottom: "0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {printer.group && <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: printer.group.color, flexShrink: 0 }} />}
                <h2 style={{ fontWeight: 700, fontSize: "17px" }}>{printer.name}</h2>
              </div>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                {[printer.model, printer.location].filter(Boolean).join(" · ") || printer.apiType}
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}><IconEdit /></button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><IconX /></button>
            </div>
          </div>

          {printer.tags.length > 0 && (
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "10px" }}>
              {printer.tags.map((tag) => (
                <span key={tag} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: "var(--panel-muted, #18181f)", color: "var(--text-muted)" }}>{tag}</span>
              ))}
            </div>
          )}

          <div style={{ display: "flex" }}>
            {(["status", "maintenance", "filament"] as ActiveDetail[]).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{
                padding: "8px 14px", fontSize: "13px",
                fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? "var(--primary)" : "var(--text-muted)",
                background: "none", border: "none",
                borderBottom: `2px solid ${activeTab === tab ? "var(--primary)" : "transparent"}`,
                cursor: "pointer",
              }}>
                {tab === "status" ? text(lang, "Status", "Status")
                  : tab === "maintenance" ? text(lang, "Wartung", "Maintenance")
                  : text(lang, "Filament", "Filament")}
              </button>
            ))}
          </div>
        </div>

        {/* Status Tab */}
        {activeTab === "status" && (
          <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: stateColor(status?.state ?? null, status?.connected ?? false), flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: "14px", color: stateColor(status?.state ?? null, status?.connected ?? false) }}>
                  {status ? stateLabel(status.state, status.connected, lang) : text(lang, "Lädt…", "Loading…")}
                </span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onStatusRefresh}><IconRefresh /></button>
            </div>

            {printer.webcamUrl && (
              <div style={{ marginBottom: "16px", borderRadius: "8px", overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
                <img src={printer.webcamUrl} alt="Webcam" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}

            {status?.connected && status.state?.toLowerCase() === "printing" && status.progress != null && (
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>{status.jobName ?? "–"}</span>
                  <span style={{ fontSize: "12.5px", fontWeight: 700 }}>{Math.round(status.progress)}%</span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: "var(--border)" }}>
                  <div style={{ height: "100%", borderRadius: "3px", background: "var(--primary)", width: `${status.progress}%`, transition: "width 0.5s" }} />
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
                  {status.timePrintingS != null && <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>⏱ {fmtTime(status.timePrintingS)}</span>}
                  {status.timeRemainingS != null && <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>🏁 {text(lang, "Noch", "Rem.")} {fmtTime(status.timeRemainingS)}</span>}
                </div>
              </div>
            )}

            {status?.connected && (status.nozzleTempC != null || status.bedTempC != null) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                <div className="panel" style={{ padding: "12px 14px", textAlign: "center" }}>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "3px" }}>🌡️ {text(lang, "Düse", "Nozzle")}</p>
                  <p style={{ fontSize: "18px", fontWeight: 700 }}>{fmtTemp(status.nozzleTempC)}</p>
                </div>
                <div className="panel" style={{ padding: "12px 14px", textAlign: "center" }}>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "3px" }}>🔥 {text(lang, "Bett", "Bed")}</p>
                  <p style={{ fontSize: "18px", fontWeight: 700 }}>{fmtTemp(status.bedTempC)}</p>
                </div>
              </div>
            )}

            {status?.filamentUsedG != null && (
              <div className="panel" style={{ padding: "12px 14px", marginBottom: "14px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "2px" }}>{text(lang, "Verbrauch dieses Drucks", "This print usage")}</p>
                <p style={{ fontSize: "15px", fontWeight: 700 }}>{status.filamentUsedG.toFixed(1)} g</p>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {status?.connected && status.state?.toLowerCase() === "printing" && (
                <>
                  <ControlButton printerId={printer.id} action="pause" lang={lang} onDone={onStatusRefresh}>
                    <IconPause /> {text(lang, "Pause", "Pause")}
                  </ControlButton>
                  <ControlButton printerId={printer.id} action="stop" lang={lang} onDone={onStatusRefresh} danger>
                    <IconStop /> {text(lang, "Stop", "Stop")}
                  </ControlButton>
                </>
              )}
              {status?.connected && status.state?.toLowerCase() === "paused" && (
                <ControlButton printerId={printer.id} action="resume" lang={lang} onDone={onStatusRefresh}>
                  <IconPlay /> {text(lang, "Fortsetzen", "Resume")}
                </ControlButton>
              )}
            </div>

            {printer.lastJobName && (
              <div style={{ marginTop: "16px", padding: "12px 14px", borderRadius: "8px", background: "var(--panel-muted, #18181f)" }}>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "2px" }}>{text(lang, "Letzter Druck", "Last print")}</p>
                <p style={{ fontSize: "13px", fontWeight: 600 }}>{printer.lastJobName}</p>
                {printer.lastJobAt && <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>{relativeDate(printer.lastJobAt, lang)}</p>}
              </div>
            )}

            {printer.notes && (
              <div style={{ marginTop: "14px", padding: "12px 14px", borderRadius: "8px", background: "var(--panel-muted, #18181f)", fontSize: "12.5px", color: "var(--text-muted)" }}>
                {printer.notes}
              </div>
            )}
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === "maintenance" && (
          <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
            <div className="panel panel-padded" style={{ marginBottom: "16px" }}>
              <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "12px" }}>{text(lang, "Eintrag hinzufügen", "Add entry")}</p>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Typ", "Type")}</label>
                <select className="input" style={{ width: "100%" }} value={maintType} onChange={(e) => setMaintType(e.target.value)}>
                  {MAINTENANCE_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>{m.emoji} {text(lang, m.de, m.en)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Datum & Uhrzeit", "Date & Time")}</label>
                <input className="input" style={{ width: "100%" }} type="datetime-local" value={maintDate} onChange={(e) => setMaintDate(e.target.value)} />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Notizen", "Notes")}</label>
                <textarea className="input" style={{ width: "100%", resize: "vertical" }} rows={2} value={maintNotes} onChange={(e) => setMaintNotes(e.target.value)} />
              </div>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={savingMaint} onClick={() => void addMaintenance()}>
                {savingMaint ? "…" : text(lang, "Eintrag speichern", "Save entry")}
              </button>
            </div>

            {maintenanceLogs.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>
                {text(lang, "Noch keine Wartungseinträge.", "No maintenance entries yet.")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {maintenanceLogs.map((log) => (
                  <div key={log.id} className="panel" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{maintenanceLabel(log.type, lang)}</p>
                      <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{relativeDate(log.performedAt, lang)}</p>
                      {log.notes && <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "4px" }}>{log.notes}</p>}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", flexShrink: 0 }} onClick={() => void deleteMaintenance(log.id)}><IconTrash /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filament Tab */}
        {activeTab === "filament" && (
          <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
            <div className="panel" style={{ padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "24px" }}>
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{text(lang, "Gesamt verbraucht", "Total used")}</p>
                <p style={{ fontSize: "16px", fontWeight: 700 }}>{totalGrams.toFixed(0)} g</p>
              </div>
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{text(lang, "Einträge", "Entries")}</p>
                <p style={{ fontSize: "16px", fontWeight: 700 }}>{filamentLogs.length}</p>
              </div>
            </div>

            <div className="panel panel-padded" style={{ marginBottom: "16px" }}>
              <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "12px" }}>{text(lang, "Verbrauch eintragen", "Log usage")}</p>

              <div style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>{text(lang, "Spule (optional)", "Spool (optional)")}</label>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: "11px", gap: "4px" }} onClick={() => void scanNfc()} disabled={nfcScanning}>
                    <IconNfc /> {nfcScanning ? text(lang, "Scannt…", "Scanning…") : "NFC"}
                  </button>
                </div>
                <select className="input" style={{ width: "100%" }} value={spoolId} onChange={(e) => setSpoolId(e.target.value)}>
                  <option value="">{text(lang, "Keine Spule verknüpfen", "No spool link")}</option>
                  {spools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.material}{s.colorName ? ` (${s.colorName})` : ""}{s.remainingWeightGrams != null ? ` | ${s.remainingWeightGrams}g ${text(lang, "übrig", "left")}` : ""}
                    </option>
                  ))}
                </select>
                {spoolId && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "12.5px", cursor: "pointer" }}>
                    <input type="checkbox" checked={deductFromSpool} onChange={(e) => setDeductFromSpool(e.target.checked)} />
                    {text(lang, "Von Spule abziehen (Filament Vault)", "Deduct from spool (Filament Vault)")}
                  </label>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Verbrauch (g) *", "Usage (g) *")}</label>
                  <input className="input" style={{ width: "100%" }} type="number" min="0" step="0.1" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="45.2" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Job-Name", "Job name")}</label>
                  <input className="input" style={{ width: "100%" }} value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="Halter_v3.stl" />
                </div>
              </div>

              {!spoolId && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Material", "Material")}</label>
                    <input className="input" style={{ width: "100%" }} value={matName} onChange={(e) => setMatName(e.target.value)} placeholder="PLA" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" }}>{text(lang, "Farbe", "Color")}</label>
                    <input className="input" style={{ width: "100%" }} value={colName} onChange={(e) => setColName(e.target.value)} placeholder="Galaxy Black" />
                  </div>
                </div>
              )}

              <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={!grams || Number(grams) <= 0 || savingFil} onClick={() => void addFilamentLog()}>
                {savingFil ? "…" : text(lang, "Eintragen", "Log")}
              </button>
            </div>

            {filamentLogs.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>
                {text(lang, "Noch keine Filamenteinträge.", "No filament entries yet.")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filamentLogs.map((log) => (
                  <div key={log.id} className="panel" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                        <span style={{ fontWeight: 700, fontSize: "14px" }}>{log.gramsUsed.toFixed(1)} g</span>
                        {log.spoolId && <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "20px", background: "color-mix(in srgb, var(--primary) 15%, var(--panel))", color: "var(--primary)" }}>🔗 Vault</span>}
                      </div>
                      {log.jobName && <p style={{ fontSize: "12.5px", fontWeight: 600 }}>{log.jobName}</p>}
                      <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                        {[log.materialName, log.colorName].filter(Boolean).join(" · ")}{" · "}{relativeDate(log.loggedAt, lang)}
                      </p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", flexShrink: 0 }} onClick={() => void deleteFilamentLog(log.id)}><IconTrash /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Printer Card ─────────────────────────────────────────────────────────────

function PrinterCard({ printer, status, lang, onSelect }: {
  printer: Printer;
  status: PrinterStatus | null;
  lang: Language;
  onSelect: () => void;
}) {
  const isPrinting = status?.connected && status.state?.toLowerCase() === "printing";
  const sc = stateColor(status?.state ?? null, status?.connected ?? false);

  return (
    <div
      className="panel"
      style={{ cursor: "pointer", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", borderLeft: `3px solid ${printer.group?.color ?? "var(--border)"}` }}
      onClick={onSelect}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: sc, flexShrink: 0 }} />
            <p style={{ fontWeight: 700, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{printer.name}</p>
          </div>
          <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>
            {printer.model ?? printer.apiType}{printer.location ? ` · ${printer.location}` : ""}
          </p>
        </div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: sc, flexShrink: 0 }}>
          {status ? stateLabel(status.state, status.connected, lang) : "…"}
        </span>
      </div>

      {isPrinting && status.progress != null && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{status.jobName ?? "–"}</span>
            <span style={{ fontSize: "11.5px", fontWeight: 700 }}>{Math.round(status.progress)}%</span>
          </div>
          <div style={{ height: "4px", borderRadius: "2px", background: "var(--border)" }}>
            <div style={{ height: "100%", borderRadius: "2px", background: "var(--primary)", width: `${status.progress}%` }} />
          </div>
          {status.timeRemainingS != null && (
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>🏁 {text(lang, "Noch", "Rem.")} {fmtTime(status.timeRemainingS)}</p>
          )}
        </div>
      )}

      {printer.webcamUrl && (
        <div style={{ borderRadius: "6px", overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
          <img src={printer.webcamUrl} alt="cam" style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
        </div>
      )}

      {status?.connected && (status.nozzleTempC != null || status.bedTempC != null) && (
        <div style={{ display: "flex", gap: "12px" }}>
          {status.nozzleTempC != null && <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>🌡️ {Math.round(status.nozzleTempC)}°C</span>}
          {status.bedTempC != null && <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>🔥 {Math.round(status.bedTempC)}°C</span>}
        </div>
      )}

      {printer.tags.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {printer.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{ fontSize: "10.5px", padding: "1px 7px", borderRadius: "20px", background: "var(--panel-muted, #18181f)", color: "var(--text-muted)" }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PrinterFarmPageClient() {
  const { settings } = useMakershelf();
  const lang = settings.language;

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [groups, setGroups] = useState<PrinterGroup[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PrinterStatus>>({});
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [detailPrinter, setDetailPrinter] = useState<Printer | null>(null);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PrinterGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const inFlight = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const fetchAll = useCallback(async () => {
    const [pRes, gRes] = await Promise.all([
      fetch("/api/printer-farm/printers"),
      fetch("/api/printer-farm/groups"),
    ]);
    if (pRes.ok) {
      const data = await pRes.json() as { printers: Printer[] };
      setPrinters(data.printers);
    }
    if (gRes.ok) setGroups(await gRes.json() as PrinterGroup[]);
    setLoading(false);
  }, []);

  const pollStatus = useCallback(async (printerList: Printer[]) => {
    await Promise.all(printerList.filter((p) => p.active).map(async (p) => {
      if (inFlight.current.has(p.id)) return;
      inFlight.current.add(p.id);
      try {
        const res = await fetch(`/api/printer-farm/printers/${p.id}/status`);
        if (res.ok) setStatuses((prev) => ({ ...prev, [p.id]: (res.json() as unknown as PrinterStatus) }));
        if (res.ok) {
          const s = await res.clone().json() as PrinterStatus;
          setStatuses((prev) => ({ ...prev, [p.id]: s }));
        }
      } finally {
        inFlight.current.delete(p.id);
      }
    }));
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (printers.length === 0) return;
    void pollStatus(printers);
    pollRef.current = setInterval(() => void pollStatus(printers), 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [printers, pollStatus]);

  const visiblePrinters = activeGroupFilter === "all"
    ? printers
    : printers.filter((p) => p.groupId === activeGroupFilter);

  async function deletePrinter(id: string) {
    if (!confirm(text(lang, "Drucker wirklich löschen?", "Really delete printer?"))) return;
    await fetch(`/api/printer-farm/printers/${id}`, { method: "DELETE" });
    void fetchAll();
  }

  async function deleteGroup(id: string) {
    if (!confirm(text(lang, "Gruppe wirklich löschen?", "Really delete group?"))) return;
    await fetch(`/api/printer-farm/groups/${id}`, { method: "DELETE" });
    void fetchAll();
  }

  function handleExport() {
    const a = document.createElement("a");
    a.href = "/api/printer-farm/import-export";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImportBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const res = await fetch("/api/printer-farm/import-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json() as { created?: number; skipped?: string[]; error?: string };
      if (!res.ok) {
        alert(data.error ?? "Import fehlgeschlagen.");
      } else {
        const msg = `${data.created ?? 0} Drucker importiert${(data.skipped?.length ?? 0) > 0 ? ` · ${data.skipped!.length} übersprungen` : ""}.`;
        alert(msg);
        void fetchAll();
      }
    } catch {
      alert("Datei konnte nicht gelesen werden. Bitte prüfe das Format.");
    }
    setImportBusy(false);
  }

  const printingCount = Object.values(statuses).filter((s) => s.state?.toLowerCase() === "printing").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(lang, "Drucker Farm", "Printer Farm")}</h1>
          <p className="page-subtitle">
            {printers.length} {text(lang, "Drucker", "printers")}
            {printingCount > 0 && ` · ${printingCount} ${text(lang, "drucken gerade", "printing")}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost btn-sm" title={text(lang, "Backup exportieren", "Export backup")} onClick={handleExport}>
            <IconDownload />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" title={text(lang, "Backup importieren", "Import backup")} disabled={importBusy} onClick={() => importFileRef.current?.click()}>
            <IconUpload />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDiscoveryOpen(true)}>
            <IconSearch /> {text(lang, "Netzwerk scannen", "Scan network")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingGroup(null); setGroupDrawerOpen(true); }}>
            <IconPlus /> {text(lang, "Gruppe", "Group")}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setEditingPrinter(null); setDrawerOpen(true); }}>
            <IconPlus /> {text(lang, "Drucker", "Printer")}
          </button>
        </div>
      </div>

      {/* Group filter + management */}
      {groups.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            {[{ id: "all", name: text(lang, "Alle", "All"), color: "var(--primary)" }, ...groups].map((g) => (
              <button
                key={g.id}
                type="button"
                className={`btn btn-sm${activeGroupFilter === g.id ? " btn-primary" : " btn-ghost"}`}
                onClick={() => setActiveGroupFilter(g.id)}
              >
                {g.id !== "all" && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: g.color, display: "inline-block", marginRight: "4px" }} />}
                {g.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {groups.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "11.5px", color: "var(--text-muted)" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: g.color }} />
                <span>{g.name}</span>
                {g._count?.printers != null && <span>({g._count.printers})</span>}
                <button type="button" className="btn btn-ghost" style={{ padding: "0 2px", height: "auto", minWidth: 0, lineHeight: 1 }} onClick={() => { setEditingGroup(g); setGroupDrawerOpen(true); }}><IconEdit /></button>
                <button type="button" className="btn btn-ghost" style={{ padding: "0 2px", height: "auto", minWidth: 0, lineHeight: 1, color: "var(--danger)" }} onClick={() => void deleteGroup(g.id)}><IconTrash /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{text(lang, "Lädt…", "Loading…")}</p>
      ) : visiblePrinters.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "36px", marginBottom: "12px" }}>🖨️</p>
          <p style={{ fontWeight: 600, marginBottom: "6px" }}>{text(lang, "Noch keine Drucker", "No printers yet")}</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            {text(lang, "Füge deinen ersten Drucker hinzu um Status, Wartung und Verbrauch zu tracken.", "Add your first printer to track status, maintenance and usage.")}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => { setEditingPrinter(null); setDrawerOpen(true); }}>
            <IconPlus /> {text(lang, "Drucker hinzufügen", "Add printer")}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
          {visiblePrinters.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <PrinterCard printer={p} status={statuses[p.id] ?? null} lang={lang} onSelect={() => setDetailPrinter(p)} />
              <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ background: "var(--panel)", border: "1px solid var(--border)" }} onClick={() => { setEditingPrinter(p); setDrawerOpen(true); }}><IconEdit /></button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ background: "var(--panel)", border: "1px solid var(--border)", color: "var(--danger)" }} onClick={() => void deletePrinter(p.id)}><IconTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {drawerOpen && (
        <PrinterDrawer lang={lang} printer={editingPrinter} groups={groups}
          onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); void fetchAll(); }} />
      )}
      {groupDrawerOpen && (
        <GroupDrawer lang={lang} group={editingGroup}
          onClose={() => setGroupDrawerOpen(false)} onSaved={() => { setGroupDrawerOpen(false); void fetchAll(); }} />
      )}
      {detailPrinter && (
        <PrinterDetailPanel
          lang={lang} printer={detailPrinter} status={statuses[detailPrinter.id] ?? null}
          onClose={() => setDetailPrinter(null)}
          onEdit={() => { setEditingPrinter(detailPrinter); setDetailPrinter(null); setDrawerOpen(true); }}
          onStatusRefresh={() => void pollStatus([detailPrinter])}
        />
      )}
      {discoveryOpen && (
        <DiscoveryModal
          lang={lang}
          onClose={() => setDiscoveryOpen(false)}
          onAdded={() => { setDiscoveryOpen(false); void fetchAll(); }}
        />
      )}
      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => void handleImportFile(e)}
      />
    </div>
  );
}
