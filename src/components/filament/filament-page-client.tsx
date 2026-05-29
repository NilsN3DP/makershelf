"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NfcOverlay } from "@/src/components/filament/nfc-overlay";
import { SpoolIcon } from "@/src/components/filament/spool-icon";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { useToast } from "@/src/components/ui/toast";
import type { PrusaLinkStatus } from "@/app/api/integrations/prusa-link/route";
import {
  barcodeReaderFallbackMessage,
  isReadableBarcodeValue,
  normalizeBarcodeReaderValue,
} from "@/src/lib/barcode-reader-core.mjs";
import { buildOpenPrintTagPayload } from "@/src/lib/filament-core.mjs";
import { hexLuminance } from "@/src/lib/filament-color";
import { isNfcSupported, openPrintTagToFormFields, readNfcTag, writeNfcTag } from "@/src/lib/filament-nfc";
import { text } from "@/src/lib/locale";
import type { Language } from "@/src/lib/makershelf-data";

// ─── Types ───────────────────────────────────────────────────────────────────

type FilamentScope = "PRIVATE" | "TEAM";
type FilamentStatus = "FULL" | "OPEN" | "LOW" | "EMPTY" | "ARCHIVED";

type FilamentSpool = {
  id: string;
  scope: FilamentScope;
  ownerUserId: string | null;
  ownerName: string | null;
  createdByName: string;
  name: string;
  manufacturer: string | null;
  filamentSeries: string | null;
  manufacturerSku: string | null;
  vendorName: string | null;
  purchaseDate: string | null;
  purchasePriceCents: number | null;
  lotNumber: string | null;
  material: string;
  colorName: string | null;
  colorHex: string | null;
  diameterMm: number;
  netWeightGrams: number | null;
  tareWeightGrams: number | null;
  remainingWeightGrams: number | null;
  densityGcm3: number | null;
  nozzleTempMinC: number | null;
  nozzleTempMaxC: number | null;
  bedTempC: number | null;
  flowFactor: number | null;
  dryingTempC: number | null;
  dryingHours: number | null;
  barcodeValue: string | null;
  barcodeFormat: string | null;
  externalSpoolUrl: string | null;
  lastScannedAt: string | null;
  location: string | null;
  status: FilamentStatus;
  openPrintTagId: string | null;
  openPrintTagVersion: string | null;
  notes: string | null;
  updatedAt: string;
};

type ManufacturerPreset = {
  id: string;
  manufacturer: string;
  aliases?: string[];
  defaultTareWeightGrams?: number | null;
  website: string;
  materials: Array<{
    material: string;
    densityGcm3?: number;
    nozzleTempMinC?: number;
    nozzleTempMaxC?: number;
    bedTempC?: number;
    dryingTempC?: number;
    dryingHours?: number;
  }>;
};

type UsageEntry = {
  id: string;
  gramsUsed: number;
  note: string | null;
  createdAt: string;
  projectTitle?: string | null;
  userName?: string | null;
};

type BrowserBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
};

type BrowserBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BrowserBarcodeDetector;

type PrusaStatus = PrusaLinkStatus;

type FormState = {
  scope: FilamentScope;
  name: string;
  manufacturer: string;
  filamentSeries: string;
  manufacturerSku: string;
  vendorName: string;
  purchaseDate: string;
  purchasePriceCents: string;
  lotNumber: string;
  material: string;
  colorName: string;
  colorHex: string;
  netWeightGrams: string;
  tareWeightGrams: string;
  remainingWeightGrams: string;
  densityGcm3: string;
  nozzleTempMinC: string;
  nozzleTempMaxC: string;
  bedTempC: string;
  flowFactor: string;
  dryingTempC: string;
  dryingHours: string;
  barcodeValue: string;
  barcodeFormat: string;
  externalSpoolUrl: string;
  location: string;
  notes: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const emptyForm: FormState = {
  scope: "PRIVATE",
  name: "",
  manufacturer: "",
  filamentSeries: "",
  manufacturerSku: "",
  vendorName: "",
  purchaseDate: "",
  purchasePriceCents: "",
  lotNumber: "",
  material: "PLA",
  colorName: "",
  colorHex: "#f97316",
  netWeightGrams: "1000",
  tareWeightGrams: "",
  remainingWeightGrams: "",
  densityGcm3: "",
  nozzleTempMinC: "",
  nozzleTempMaxC: "",
  bedTempC: "",
  flowFactor: "",
  dryingTempC: "",
  dryingHours: "",
  barcodeValue: "",
  barcodeFormat: "",
  externalSpoolUrl: "",
  location: "",
  notes: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function numberToInput(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function statusBadgeClass(status: FilamentStatus) {
  if (status === "FULL") return "badge-success";
  if (status === "OPEN") return "badge-primary";
  if (status === "LOW") return "badge-warning";
  if (status === "EMPTY") return "badge-danger";
  return "badge-neutral";
}

function statusLabel(status: FilamentStatus, lang: Language) {
  if (status === "FULL") return text(lang, "Eingeschweißt", "Sealed");
  if (status === "OPEN") return text(lang, "Offen", "Open");
  if (status === "LOW") return text(lang, "Niedrig", "Low");
  if (status === "EMPTY") return text(lang, "Leer", "Empty");
  return text(lang, "Archiv", "Archived");
}

function spoolToForm(spool: FilamentSpool): FormState {
  return {
    scope: spool.scope,
    name: spool.name,
    manufacturer: spool.manufacturer ?? "",
    filamentSeries: spool.filamentSeries ?? "",
    manufacturerSku: spool.manufacturerSku ?? "",
    vendorName: spool.vendorName ?? "",
    purchaseDate: spool.purchaseDate ?? "",
    purchasePriceCents: numberToInput(spool.purchasePriceCents),
    lotNumber: spool.lotNumber ?? "",
    material: spool.material,
    colorName: spool.colorName ?? "",
    colorHex: spool.colorHex ?? "#f97316",
    netWeightGrams: numberToInput(spool.netWeightGrams),
    tareWeightGrams: numberToInput(spool.tareWeightGrams),
    remainingWeightGrams: numberToInput(spool.remainingWeightGrams),
    densityGcm3: numberToInput(spool.densityGcm3),
    nozzleTempMinC: numberToInput(spool.nozzleTempMinC),
    nozzleTempMaxC: numberToInput(spool.nozzleTempMaxC),
    bedTempC: numberToInput(spool.bedTempC),
    flowFactor: numberToInput(spool.flowFactor),
    dryingTempC: numberToInput(spool.dryingTempC),
    dryingHours: numberToInput(spool.dryingHours),
    barcodeValue: spool.barcodeValue ?? "",
    barcodeFormat: spool.barcodeFormat ?? "",
    externalSpoolUrl: spool.externalSpoolUrl ?? "",
    location: spool.location ?? "",
    notes: spool.notes ?? "",
  };
}

function formToPayload(form: FormState, nullifyEmpty = false) {
  const base = {
    ...form,
    netWeightGrams: toNumber(form.netWeightGrams),
    tareWeightGrams: toNumber(form.tareWeightGrams),
    remainingWeightGrams: toNumber(form.remainingWeightGrams),
    purchasePriceCents: toNumber(form.purchasePriceCents),
    densityGcm3: toNumber(form.densityGcm3),
    nozzleTempMinC: toNumber(form.nozzleTempMinC),
    nozzleTempMaxC: toNumber(form.nozzleTempMaxC),
    bedTempC: toNumber(form.bedTempC),
    flowFactor: toNumber(form.flowFactor),
    dryingTempC: toNumber(form.dryingTempC),
    dryingHours: toNumber(form.dryingHours),
  };
  if (!nullifyEmpty) return base;
  return {
    ...base,
    manufacturer: form.manufacturer || null,
    filamentSeries: form.filamentSeries || null,
    manufacturerSku: form.manufacturerSku || null,
    vendorName: form.vendorName || null,
    purchaseDate: form.purchaseDate || null,
    lotNumber: form.lotNumber || null,
    colorName: form.colorName || null,
    colorHex: form.colorHex || null,
    barcodeValue: form.barcodeValue || null,
    barcodeFormat: form.barcodeFormat || null,
    externalSpoolUrl: form.externalSpoolUrl || null,
    location: form.location || null,
    notes: form.notes || null,
  };
}

function filamentBarColor(colorHex: string | null): string {
  if (!colorHex) return "var(--text-soft)";
  return hexLuminance(colorHex) < 0.06 ? "#555555" : colorHex;
}

// ─── Form sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "var(--text-soft)",
        marginBottom: "8px",
      }}
    >
      {children}
    </p>
  );
}

function FieldGrid({ cols, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div
      style={
        cols
          ? { display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "8px" }
          : { display: "contents" }
      }
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <label style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

type MaterialSuggestion = {
  presetId: string;
  manufacturer: string;
  material: string;
  densityGcm3?: number;
  nozzleTempMinC?: number;
  nozzleTempMaxC?: number;
  bedTempC?: number;
  dryingTempC?: number;
  dryingHours?: number;
};

type MaterialComboboxProps = {
  value: string;
  suggestions: MaterialSuggestion[];
  onInputChange: (value: string) => void;
  onSelect: (suggestion: MaterialSuggestion) => void;
  placeholder?: string;
};

function MaterialCombobox({ value, suggestions, onInputChange, onSelect, placeholder = "Material wählen oder frei eingeben" }: MaterialComboboxProps) {
  const [open, setOpen] = useState(false);
  const term = value.trim().toLowerCase();
  const filtered = (term
    ? suggestions.filter((suggestion) =>
        suggestion.material.toLowerCase().includes(term) ||
        suggestion.manufacturer.toLowerCase().includes(term),
      )
    : suggestions
  ).slice(0, 40);

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        value={value}
        onChange={(e) => {
          onInputChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder={placeholder}
        required
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 3px)",
            left: 0,
            right: 0,
            zIndex: 210,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            maxHeight: "260px",
            overflowY: "auto",
          }}
        >
          {filtered.map((suggestion, index) => (
            <button
              key={`${suggestion.presetId}-${suggestion.material}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(suggestion);
                setOpen(false);
              }}
              style={{
                display: "grid",
                gap: "2px",
                width: "100%",
                textAlign: "left",
                padding: "9px 12px",
                background: "none",
                border: "none",
                borderBottom: index < filtered.length - 1 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-muted)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
            >
              <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-main)" }}>
                {suggestion.material}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>
                {suggestion.manufacturer}
                {suggestion.nozzleTempMinC && suggestion.nozzleTempMaxC
                  ? ` · ${suggestion.nozzleTempMinC}-${suggestion.nozzleTempMaxC} °C`
                  : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilamentPageClientProps = {
  /** Spool ID from ?spool= URL param — set by iOS when opening an NFC tag URL. */
  initialSpoolId?: string;
};

export function FilamentPageClient({ initialSpoolId }: FilamentPageClientProps) {
  const { settings, projects } = useMakershelf();
  const { toast } = useToast();

  // Data
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [presets, setPresets] = useState<ManufacturerPreset[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | FilamentScope>("ALL");

  // Drawer
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | "batch" | null>(null);
  const [drawerSpool, setDrawerSpool] = useState<FilamentSpool | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [batchQuantity, setBatchQuantity] = useState("3");

  // Inline remaining weight edit
  const [remainingEditId, setRemainingEditId] = useState<string | null>(null);
  const [remainingEditVal, setRemainingEditVal] = useState("");

  // NFC
  const [nfcMode, setNfcMode] = useState<"searching" | "reading" | "writing" | null>(null);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const prusaInFlightRef = useRef(false);

  // QR / OpenPrintTag fallback
  const [qrModal, setQrModal] = useState<{ spool: FilamentSpool; qrCode: string; tagUrl: string } | null>(null);

  // Expandable rows
  const [expandedSpoolId, setExpandedSpoolId] = useState<string | null>(null);

  // Prusa Link
  const [prusaStatus, setPrusaStatus] = useState<PrusaStatus | null>(null);
  const [prusaLoading, setPrusaLoading] = useState(false);
  const [prusaShowBook, setPrusaShowBook] = useState(false);
  const [prusaBookSpoolId, setPrusaBookSpoolId] = useState("");
  const [prusaBookGrams, setPrusaBookGrams] = useState("");
  const [prusaBooking, setPrusaBooking] = useState(false);

  // Scan (in add drawer)
  const [scanValue, setScanValue] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [barcodeReaderOpen, setBarcodeReaderOpen] = useState(false);
  const [barcodeReaderMessage, setBarcodeReaderMessage] = useState("");
  const [barcodeCameraActive, setBarcodeCameraActive] = useState(false);
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeStreamRef = useRef<MediaStream | null>(null);
  const barcodeFrameRef = useRef<number | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  // Inline usage log
  const [logSpoolId, setLogSpoolId] = useState<string | null>(null);
  const [usageGrams, setUsageGrams] = useState("");
  const [usageProject, setUsageProject] = useState("");

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // History (shown inside edit drawer)
  const [historyEntries, setHistoryEntries] = useState<UsageEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [spoolsRes, presetsRes] = await Promise.all([
          fetch("/api/filament/spools", { cache: "no-store" }),
          fetch("/api/filament/presets", { cache: "no-store" }),
        ]);
        const spoolsPayload = (await spoolsRes.json()) as { spools?: FilamentSpool[]; error?: string };
        if (!spoolsRes.ok) throw new Error(spoolsPayload.error ?? "Filament konnte nicht geladen werden.");
        setSpools(spoolsPayload.spools ?? []);

        if (presetsRes.ok) {
          const presetsPayload = (await presetsRes.json()) as { manufacturers?: ManufacturerPreset[] };
          setPresets(presetsPayload.manufacturers ?? []);
        }
      } catch (error) {
        toast(error instanceof Error ? error.message : "Fehler beim Laden.", "error");
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPrusa = useCallback(async () => {
    if (prusaInFlightRef.current) return;
    prusaInFlightRef.current = true;
    setPrusaLoading(true);
    try {
      const res = await fetch("/api/integrations/prusa-link", { cache: "no-store" });
      setPrusaStatus((await res.json()) as PrusaStatus);
    } catch {
      setPrusaStatus({
        ok: false, connected: false, state: null, progress: null,
        jobName: null, filamentUsedMm: null, filamentUsedG: null,
        timeRemainingS: null, timePrintingS: null, error: "Netzwerkfehler",
      });
    } finally {
      prusaInFlightRef.current = false;
      setPrusaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!settings.prusaLinkEnabled) return;
    void fetchPrusa();
    const iv = setInterval(() => void fetchPrusa(), 15_000);
    return () => clearInterval(iv);
  }, [settings.prusaLinkEnabled, fetchPrusa]);

  useEffect(() => {
    setNfcAvailable(isNfcSupported());
    return () => { nfcAbortRef.current?.abort(); };
  }, []);

  // iOS NFC: when the page is opened via a tag URL (?spool=<id>), auto-expand that spool
  useEffect(() => {
    if (!initialSpoolId || loading) return;
    if (spools.some((s) => s.id === initialSpoolId)) {
      setExpandedSpoolId(initialSpoolId);
    }
  }, [initialSpoolId, loading, spools]);

  // Scroll the auto-expanded spool into view after it renders
  useEffect(() => {
    if (!initialSpoolId || expandedSpoolId !== initialSpoolId) return;
    document
      .querySelector<HTMLElement>(`[data-spool-id="${initialSpoolId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [initialSpoolId, expandedSpoolId]);

  useEffect(() => {
    return () => stopBarcodeCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredSpools = useMemo(() => {
    const lower = search.toLowerCase();
    return spools.filter((s) => {
      if (scopeFilter !== "ALL" && s.scope !== scopeFilter) return false;
      if (!lower) return true;
      return (
        s.name.toLowerCase().includes(lower) ||
        (s.manufacturer?.toLowerCase().includes(lower) ?? false) ||
        s.material.toLowerCase().includes(lower)
      );
    });
  }, [spools, scopeFilter, search]);

  const stats = useMemo(() => {
    const lowOrEmpty = spools.filter((s) => s.status === "LOW" || s.status === "EMPTY").length;
    const totalKg = (spools.reduce((acc, s) => acc + (s.remainingWeightGrams ?? 0), 0) / 1000).toFixed(1);
    return { total: spools.length, lowOrEmpty, totalKg };
  }, [spools]);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  const materialSuggestions = useMemo(() => {
    const manufacturerTerm = form.manufacturer.trim().toLowerCase();
    const activePreset =
      selectedPreset ??
      presets.find((p) =>
        manufacturerTerm &&
        (p.manufacturer.toLowerCase() === manufacturerTerm ||
          (p.aliases ?? []).some((alias) => alias.toLowerCase() === manufacturerTerm)),
      ) ??
      null;
    const sourcePresets = activePreset ? [activePreset] : presets;
    const seen = new Set<string>();
    const suggestions: MaterialSuggestion[] = [];
    for (const preset of sourcePresets) {
      for (const material of preset.materials) {
        const key = `${preset.manufacturer.toLowerCase()}::${material.material.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push({
          presetId: preset.id,
          manufacturer: preset.manufacturer,
          material: material.material,
          densityGcm3: material.densityGcm3,
          nozzleTempMinC: material.nozzleTempMinC,
          nozzleTempMaxC: material.nozzleTempMaxC,
          bedTempC: material.bedTempC,
          dryingTempC: material.dryingTempC,
          dryingHours: material.dryingHours,
        });
      }
    }
    return suggestions.sort((a, b) => a.material.localeCompare(b.material, "de"));
  }, [form.manufacturer, presets, selectedPreset]);

  // ── Drawer helpers ────────────────────────────────────────────────────────

  function openAdd() {
    setForm(emptyForm);
    setScanValue("");
    setSelectedPresetId("");
    setDrawerSpool(null);
    setDrawerMode("add");
  }

  function openBatch() {
    setForm(emptyForm);
    setScanValue("");
    setSelectedPresetId("");
    setBatchQuantity("3");
    setDrawerSpool(null);
    setDrawerMode("batch");
  }

  function openEdit(spool: FilamentSpool) {
    setForm(spoolToForm(spool));
    setDrawerSpool(spool);
    setHistoryEntries([]);
    setDrawerMode("edit");
    void loadHistory(spool.id);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setDrawerSpool(null);
  }

  // ── Preset ────────────────────────────────────────────────────────────────

  function applyMaterialSuggestion(suggestion: MaterialSuggestion) {
    const preset = presets.find((p) => p.id === suggestion.presetId);
    setSelectedPresetId(suggestion.presetId);
    setForm((c) => ({
      ...c,
      manufacturer: suggestion.manufacturer,
      filamentSeries: c.filamentSeries || suggestion.manufacturer,
      material: suggestion.material,
      tareWeightGrams: c.tareWeightGrams || (preset?.defaultTareWeightGrams ? String(preset.defaultTareWeightGrams) : ""),
      densityGcm3: numberToInput(suggestion.densityGcm3),
      nozzleTempMinC: numberToInput(suggestion.nozzleTempMinC),
      nozzleTempMaxC: numberToInput(suggestion.nozzleTempMaxC),
      bedTempC: numberToInput(suggestion.bedTempC),
      dryingTempC: numberToInput(suggestion.dryingTempC),
      dryingHours: numberToInput(suggestion.dryingHours),
      externalSpoolUrl: c.externalSpoolUrl || preset?.website || "",
    }));
  }

  // ── Scan ─────────────────────────────────────────────────────────────────

  function getBarcodeDetectorConstructor(): BrowserBarcodeDetectorConstructor | null {
    if (typeof window === "undefined") return null;
    const candidate = (window as Window & { BarcodeDetector?: BrowserBarcodeDetectorConstructor }).BarcodeDetector;
    return candidate ?? null;
  }

  function canUseCameraBarcodeReader() {
    return Boolean(getBarcodeDetectorConstructor() && navigator.mediaDevices?.getUserMedia);
  }

  function stopBarcodeCamera() {
    if (barcodeFrameRef.current !== null) {
      window.cancelAnimationFrame(barcodeFrameRef.current);
      barcodeFrameRef.current = null;
    }
    barcodeStreamRef.current?.getTracks().forEach((track) => track.stop());
    barcodeStreamRef.current = null;
    setBarcodeCameraActive(false);
  }

  function openBarcodeReader() {
    stopBarcodeCamera();
    setBarcodeReaderOpen(true);
    setBarcodeReaderMessage(barcodeReaderFallbackMessage(canUseCameraBarcodeReader()));
    window.setTimeout(() => {
      document.getElementById("filament-barcode-reader-input")?.focus();
    }, 0);
  }

  function closeBarcodeReader() {
    stopBarcodeCamera();
    setBarcodeReaderOpen(false);
    setBarcodeReaderMessage("");
  }

  async function applyBarcodeReaderValue(value: string) {
    const normalized = normalizeBarcodeReaderValue(value);
    if (!isReadableBarcodeValue(normalized)) {
      setBarcodeReaderMessage("Barcode ist zu kurz oder leer.");
      return;
    }
    setScanValue(normalized);
    closeBarcodeReader();
    await scanFilamentCode(normalized);
  }

  async function startBarcodeCamera() {
    const Detector = getBarcodeDetectorConstructor();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setBarcodeReaderMessage(barcodeReaderFallbackMessage(false));
      return;
    }

    try {
      stopBarcodeCamera();
      setBarcodeReaderMessage(text(settings.language, "Kamera wird geöffnet...", "Opening camera..."));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      barcodeStreamRef.current = stream;
      const video = barcodeVideoRef.current;
      if (!video) {
        stopBarcodeCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      setBarcodeCameraActive(true);
      setBarcodeReaderMessage("Barcode vor die Kamera halten.");

      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "data_matrix"],
      });

      const scanFrame = async () => {
        const currentVideo = barcodeVideoRef.current;
        if (!currentVideo || !barcodeStreamRef.current) return;
        try {
          const codes = await detector.detect(currentVideo);
          const value = codes.find((code) => code.rawValue)?.rawValue;
          if (value) {
            await applyBarcodeReaderValue(value);
            return;
          }
        } catch {
          // Keep scanning; some browsers throw while the video is still warming up.
        }
        barcodeFrameRef.current = window.requestAnimationFrame(() => void scanFrame());
      };

      barcodeFrameRef.current = window.requestAnimationFrame(() => void scanFrame());
    } catch (error) {
      stopBarcodeCamera();
      setBarcodeReaderMessage(
        error instanceof Error
          ? text(settings.language, `Kamera konnte nicht geöffnet werden: ${error.message}`, `Camera could not be opened: ${error.message}`)
          : text(settings.language, "Kamera konnte nicht geöffnet werden.", "Camera could not be opened."),
      );
    }
  }

  async function scanFilamentCode(valueOverride?: string) {
    const value = normalizeBarcodeReaderValue(valueOverride ?? scanValue);
    if (!value) return;
    setScanLoading(true);
    try {
      const res = await fetch("/api/filament/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const payload = (await res.json()) as {
        rawValue: string;
        barcodeFormat: string;
        parser: string;
        confidence: string;
        suggestion: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Scan konnte nicht gelesen werden.");
      const s = payload.suggestion;
      setForm((c) => ({
        ...c,
        name:
          (s.name as string) ||
          c.name ||
          [s.manufacturer, s.material, s.colorName].filter(Boolean).join(" "),
        manufacturer: (s.manufacturer as string) ?? c.manufacturer,
        filamentSeries: (s.filamentSeries as string) ?? c.filamentSeries,
        manufacturerSku: (s.manufacturerSku as string) ?? c.manufacturerSku,
        lotNumber: (s.lotNumber as string) ?? c.lotNumber,
        material: (s.material as string) ?? c.material,
        colorName: (s.colorName as string) ?? c.colorName,
        colorHex: (s.colorHex as string) ?? c.colorHex,
        netWeightGrams: numberToInput(s.netWeightGrams) || c.netWeightGrams,
        tareWeightGrams: numberToInput(s.tareWeightGrams) || c.tareWeightGrams,
        remainingWeightGrams: numberToInput(s.remainingWeightGrams) || c.remainingWeightGrams,
        densityGcm3: numberToInput(s.densityGcm3) || c.densityGcm3,
        nozzleTempMinC: numberToInput(s.nozzleTempMinC) || c.nozzleTempMinC,
        nozzleTempMaxC: numberToInput(s.nozzleTempMaxC) || c.nozzleTempMaxC,
        bedTempC: numberToInput(s.bedTempC) || c.bedTempC,
        dryingTempC: numberToInput(s.dryingTempC) || c.dryingTempC,
        dryingHours: numberToInput(s.dryingHours) || c.dryingHours,
        barcodeValue: (s.barcodeValue as string) ?? payload.rawValue,
        barcodeFormat: payload.barcodeFormat,
        externalSpoolUrl: (s.externalSpoolUrl as string) ?? c.externalSpoolUrl,
        notes: s.notes
          ? [c.notes, s.notes as string].filter(Boolean).join("\n\n")
          : c.notes,
      }));
      toast(
        payload.parser === "prusament-live"
          ? text(settings.language, "Prusament-Daten übernommen.", "Prusament data applied.")
          : text(settings.language, "Scan-Daten ins Formular übernommen.", "Scan data applied to form."),
        "success",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Scan-Fehler.", "error");
    } finally {
      setScanLoading(false);
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async function createSpool(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/filament/spools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      });
      const payload = (await res.json()) as { spool?: FilamentSpool; error?: string };
      if (!res.ok || !payload.spool) throw new Error(payload.error ?? "Spule konnte nicht angelegt werden.");
      setSpools((c) => [payload.spool!, ...c]);
      closeDrawer();
      toast("Spule angelegt.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function createBatch(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.min(50, Math.max(1, parseInt(batchQuantity, 10) || 1));
    setSaving(true);
    try {
      const results = await Promise.all(
        Array.from({ length: qty }, (_, i) =>
          fetch("/api/filament/spools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...formToPayload(form),
              name: qty > 1 ? `${form.name} #${i + 1}` : form.name,
            }),
          }).then((r) => r.json() as Promise<{ spool?: FilamentSpool; error?: string }>),
        ),
      );
      const created = results.filter((r) => r.spool).map((r) => r.spool!);
      if (created.length === 0) throw new Error(results[0]?.error ?? "Keine Spulen angelegt.");
      setSpools((c) => [...created.reverse(), ...c]);
      closeDrawer();
      toast(
        created.length === qty
          ? `${qty} Spulen angelegt.`
          : `${created.length} von ${qty} Spulen angelegt.`,
        created.length === qty ? "success" : "warning",
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateSpool(id: string, input: Partial<FilamentSpool>) {
    try {
      const res = await fetch(`/api/filament/spools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await res.json()) as { spool?: FilamentSpool; error?: string };
      if (!res.ok || !payload.spool) throw new Error(payload.error ?? "Aktualisierung fehlgeschlagen.");
      setSpools((c) => c.map((s) => (s.id === id ? payload.spool! : s)));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler.", "error");
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!drawerSpool) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/filament/spools/${drawerSpool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form, true)),
      });
      const payload = (await res.json()) as { spool?: FilamentSpool; error?: string };
      if (!res.ok || !payload.spool) throw new Error(payload.error ?? "Speichern fehlgeschlagen.");
      setSpools((c) => c.map((s) => (s.id === drawerSpool.id ? payload.spool! : s)));
      closeDrawer();
      toast("Spule aktualisiert.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function bookUsage(spoolId: string) {
    const grams = Number(usageGrams || 0);
    if (!grams) return;
    try {
      const res = await fetch("/api/filament/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoolId, gramsUsed: grams, projectId: usageProject || null }),
      });
      const payload = (await res.json()) as { spool?: FilamentSpool; error?: string };
      if (!res.ok || !payload.spool) throw new Error(payload.error ?? "Verbrauch konnte nicht gebucht werden.");
      setSpools((c) => c.map((s) => (s.id === spoolId ? payload.spool! : s)));
      setLogSpoolId(null);
      setUsageGrams("");
      setUsageProject("");
      toast("Verbrauch gebucht.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler.", "error");
    }
  }

  async function deleteSpool(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/filament/spools/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? text(settings.language, "Spule konnte nicht gelöscht werden.", "Spool could not be deleted."));
      }
      setSpools((c) => c.filter((s) => s.id !== id));
      setDeleteConfirmId(null);
      if (drawerSpool?.id === id) closeDrawer();
      toast(text(settings.language, "Spule gelöscht.", "Spool deleted."), "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function copyTagPayload(spool: FilamentSpool) {
    const payload = buildOpenPrintTagPayload(spool);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast(text(settings.language, "OpenPrintTag-Payload kopiert.", "OpenPrintTag payload copied."), "success");
    } catch {
      toast(text(settings.language, "Clipboard nicht verfügbar.", "Clipboard not available."), "error");
    }
  }

  function buildTagUrl(spool: FilamentSpool) {
    return `${window.location.origin}/filament?spool=${encodeURIComponent(spool.id)}`;
  }

  async function showQrCode(spool: FilamentSpool) {
    try {
      const tagUrl = buildTagUrl(spool);
      const payload = buildOpenPrintTagPayload(spool);
      const qrPayload = JSON.stringify({ url: tagUrl, openPrintTag: payload });
      const qrCode = await QRCode.toDataURL(qrPayload, {
        margin: 2,
        scale: 7,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrModal({ spool, qrCode, tagUrl });
    } catch (error) {
      toast(error instanceof Error ? error.message : "QR-Code konnte nicht erzeugt werden.", "error");
    }
  }

  async function loadHistory(spoolId: string) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/filament/usage?spoolId=${spoolId}`, { cache: "no-store" });
      const payload = (await res.json()) as { entries?: UsageEntry[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Verlauf konnte nicht geladen werden.");
      setHistoryEntries(payload.entries ?? []);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler.", "error");
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Prusa Link booking ────────────────────────────────────────────────────

  async function bookFromPrusa() {
    const grams = parseFloat(prusaBookGrams);
    if (!prusaBookSpoolId || !grams) return;
    setPrusaBooking(true);
    try {
      const res = await fetch("/api/filament/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoolId: prusaBookSpoolId, gramsUsed: grams, projectId: null }),
      });
      const payload = (await res.json()) as { spool?: FilamentSpool; error?: string };
      if (!res.ok || !payload.spool) throw new Error(payload.error ?? "Buchung fehlgeschlagen.");
      setSpools((c) => c.map((s) => (s.id === prusaBookSpoolId ? payload.spool! : s)));
      setPrusaShowBook(false);
      setPrusaBookSpoolId("");
      setPrusaBookGrams("");
      toast(`${grams} g von Prusa Link gebucht.`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Buchungsfehler.", "error");
    } finally {
      setPrusaBooking(false);
    }
  }

  // ── NFC ──────────────────────────────────────────────────────────────────

  function cancelNfc() {
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    setNfcMode(null);
  }

  function applyOpenPrintTagPayload(payload: Record<string, unknown>) {
    const fields = openPrintTagToFormFields(payload);
    const spoolPayload = (payload.spool ?? payload) as Record<string, unknown>;
    const candidateId =
      typeof spoolPayload.id === "string"
        ? spoolPayload.id
        : typeof payload.tagId === "string"
          ? payload.tagId
          : "";
    const existing = candidateId ? spools.find((spool) => spool.id === candidateId || spool.openPrintTagId === candidateId) : null;

    if (existing) {
      openEdit(existing);
      toast(text(settings.language, "NFC-Tag erkannt — bestehende Spule geöffnet.", "NFC tag detected — existing spool opened."), "success");
      return;
    }

    setForm((current) => ({ ...current, ...fields }));
    if (!drawerMode) {
      setDrawerSpool(null);
      setDrawerMode("add");
    }
    toast(text(settings.language, "OpenPrintTag eingelesen — Daten ins Formular übernommen.", "OpenPrintTag read — data applied to form."), "success");
  }

  const startNfcRead = useCallback(async () => {
    const abort = new AbortController();
    nfcAbortRef.current = abort;
    setNfcMode("searching");
    await new Promise<void>((r) => setTimeout(r, 650));
    if (abort.signal.aborted) return;
    if (!isNfcSupported()) {
      setNfcMode(null);
      nfcAbortRef.current = null;
      toast(
        text(settings.language, "Kein NFC-Reader gefunden. Web NFC wird nur von Chrome auf Android oder Desktops mit NFC-Hardware unterstützt.", "No NFC reader found. Web NFC is only supported by Chrome on Android or desktops with NFC hardware."),
        "error",
      );
      return;
    }
    setNfcMode("reading");
    try {
      const result = await readNfcTag(abort.signal);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }

      if (result.type === "openprinttag") {
        applyOpenPrintTagPayload(result.payload);
        return;
      }

      if (result.type === "url") {
        // Route through the scan API so Prusament live-lookup and other URL parsers apply
        const res = await fetch("/api/filament/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: result.url }),
        });
        const scanPayload = (await res.json()) as {
          suggestion: Record<string, unknown>;
          parser: string;
          rawValue: string;
          barcodeFormat: string;
          error?: string;
        };
        if (!res.ok) throw new Error(scanPayload.error ?? "Scan-Fehler.");
        const s = scanPayload.suggestion;
        setForm((c) => ({
          ...c,
          name: (s.name as string) || c.name || [s.manufacturer, s.material, s.colorName].filter(Boolean).join(" "),
          manufacturer: (s.manufacturer as string) ?? c.manufacturer,
          material: (s.material as string) ?? c.material,
          colorName: (s.colorName as string) ?? c.colorName,
          colorHex: (s.colorHex as string) ?? c.colorHex,
          netWeightGrams: (typeof s.netWeightGrams === "number" ? String(s.netWeightGrams) : "") || c.netWeightGrams,
          barcodeValue: (s.barcodeValue as string) ?? scanPayload.rawValue,
          barcodeFormat: scanPayload.barcodeFormat,
        }));
        if (!drawerMode) {
          setDrawerSpool(null);
          setDrawerMode("add");
        }
        toast(text(settings.language, "NFC-URL erkannt — Daten übernommen.", "NFC URL detected — data applied."), "success");
        return;
      }

      toast(text(settings.language, "NFC-Tag gelesen, aber kein OpenPrintTag-Format erkannt.", "NFC tag read, but no OpenPrintTag format detected."), "info");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast(error instanceof Error ? error.message : text(settings.language, "NFC-Fehler.", "NFC error."), "error");
    } finally {
      setNfcMode(null);
      nfcAbortRef.current = null;
    }
  }, [drawerMode, spools, toast]);

  const startNfcWrite = useCallback(
    async (spool: FilamentSpool) => {
      const abort = new AbortController();
      nfcAbortRef.current = abort;
      setNfcMode("searching");
      await new Promise<void>((r) => setTimeout(r, 650));
      if (abort.signal.aborted) return;
      if (!isNfcSupported()) {
        setNfcMode(null);
        nfcAbortRef.current = null;
        toast(
          "Kein NFC-Reader gefunden. Web NFC wird nur von Chrome auf Android oder Desktops mit NFC-Hardware unterstützt.",
          "error",
        );
        return;
      }
      setNfcMode("writing");
      try {
        const payload = buildOpenPrintTagPayload(spool);
        const tagUrl = buildTagUrl(spool);
        await writeNfcTag(payload, tagUrl, abort.signal);

        // Persist the tag ID back to the spool record
        await updateSpool(spool.id, {
          openPrintTagId: spool.id,
          openPrintTagVersion: "0.1",
        });
        toast(text(settings.language, "NFC-Tag erfolgreich beschrieben.", "NFC tag written successfully."), "success");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast(error instanceof Error ? error.message : text(settings.language, "NFC-Schreiben fehlgeschlagen.", "NFC write failed."), "error");
      } finally {
        setNfcMode(null);
        nfcAbortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="panel panel-padded" style={{ color: "var(--text-muted)" }}>
        Filament Vault wird geladen...
      </div>
    );
  }

  const batchQty = parseInt(batchQuantity, 10) || 1;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Filament Vault</h1>
          <p className="page-subtitle" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span>{text(settings.language, `${stats.total} Spulen · ${stats.totalKg} kg Bestand`, `${stats.total} spools · ${stats.totalKg} kg in stock`)}</span>
            {stats.lowOrEmpty > 0 && (
              <span className="badge badge-warning">{text(settings.language, `${stats.lowOrEmpty} niedrig/leer`, `${stats.lowOrEmpty} low/empty`)}</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="btn btn-secondary" href="/filament/database">
            {text(settings.language, "Material-DB", "Material DB")}
          </Link>
          <button className="btn btn-secondary" type="button" onClick={() => void startNfcRead()}>
            {text(settings.language, "NFC einlesen", "Read NFC")}
          </button>
          <button className="btn btn-secondary" type="button" onClick={openBatch}>
            {text(settings.language, "Batch", "Batch")}
          </button>
          <button className="btn btn-primary" type="button" onClick={openAdd}>
            {text(settings.language, "+ Neue Spule", "+ New spool")}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: "180px" }}>
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Spulen suchen..."
          />
        </div>
        {(["ALL", "PRIVATE", "TEAM"] as const).map((scope) => (
          <button
            key={scope}
            type="button"
            className={`btn btn-sm ${scopeFilter === scope ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setScopeFilter(scope)}
          >
            {scope === "ALL" ? "Alle" : scope === "PRIVATE" ? "Privat" : "Geteilt"}
          </button>
        ))}
      </div>

      {/* ── Prusa Link panel ───────────────────────────────────────────────── */}
      {settings.prusaLinkEnabled && (
        <div
          className="panel"
          style={{ padding: "14px 16px", marginBottom: "16px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}
        >
          {/* Status info */}
          <div style={{ flex: 1, minWidth: "200px" }}>
            {prusaLoading && !prusaStatus ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Prusa Link verbinden…</p>
            ) : !prusaStatus?.connected ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                🖨️ Prusa Link — {prusaStatus?.error ?? "Nicht verbunden"}
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)", margin: "0 0 2px" }}>
                    🖨️ {prusaStatus.state ?? "Bereit"}
                    {prusaStatus.jobName && (
                      <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: "8px" }}>
                        {prusaStatus.jobName}
                      </span>
                    )}
                  </p>
                  {prusaStatus.progress != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "120px", height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "var(--primary)", width: `${prusaStatus.progress.toFixed(0)}%`, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{prusaStatus.progress.toFixed(0)}%</span>
                      {prusaStatus.timeRemainingS != null && (
                        <span style={{ fontSize: "12px", color: "var(--text-soft)" }}>
                          {Math.round(prusaStatus.timeRemainingS / 60)} min
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {prusaStatus.filamentUsedG != null && (
                  <span className="badge badge-neutral" style={{ fontSize: "11.5px" }}>
                    {prusaStatus.filamentUsedG.toFixed(1)} g verbraucht
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
            {prusaStatus?.connected && prusaStatus.filamentUsedG != null && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setPrusaShowBook((v) => !v);
                  if (!prusaBookGrams && prusaStatus.filamentUsedG != null) {
                    setPrusaBookGrams(prusaStatus.filamentUsedG.toFixed(1));
                  }
                }}
              >
                Buchen
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={prusaLoading}
              onClick={() => void fetchPrusa()}
            >
              {prusaLoading ? "…" : "↻"}
            </button>
          </div>

          {/* Booking row */}
          {prusaShowBook && (
            <div
              style={{
                flexBasis: "100%",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
                padding: "10px 0 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                Buchen auf:
              </span>
              <select
                className="input select"
                style={{ flex: 1, minWidth: "160px" }}
                value={prusaBookSpoolId}
                onChange={(e) => setPrusaBookSpoolId(e.target.value)}
              >
                <option value="">{text(settings.language, "Spule wählen…", "Select spool…")}</option>
                {spools
                  .filter((s) => s.status !== "ARCHIVED")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.remainingWeightGrams != null ? `${s.remainingWeightGrams} g` : "?"})
                    </option>
                  ))}
              </select>
              <input
                className="input"
                type="number"
                value={prusaBookGrams}
                onChange={(e) => setPrusaBookGrams(e.target.value)}
                placeholder="Gramm"
                style={{ width: "90px" }}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!prusaBookSpoolId || !prusaBookGrams || prusaBooking}
                onClick={() => void bookFromPrusa()}
              >
                {prusaBooking ? "…" : "Buchen"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setPrusaShowBook(false)}
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Spool list */}
      {filteredSpools.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <p className="empty-state-title">{text(settings.language, "Keine Spulen", "No spools")}</p>
            <p className="empty-state-desc">
              {search || scopeFilter !== "ALL"
                ? text(settings.language, "Keine Spulen gefunden. Filter oder Suche anpassen.", "No spools found. Adjust filters or search.")
                : text(settings.language, "Noch keine Spulen vorhanden. Klicke \"+ Neue Spule\" um loszulegen.", "No spools yet. Click \"+ New spool\" to get started.")}
            </p>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ overflow: "hidden" }}>
          {filteredSpools.map((spool, idx) => {
            const pct = Math.round(
              ((spool.remainingWeightGrams ?? spool.netWeightGrams ?? 0) / (spool.netWeightGrams || 1)) * 100,
            );
            const clampedPct = Math.min(100, Math.max(0, pct));
            const barFill = filamentBarColor(spool.colorHex);
            const isLogging = logSpoolId === spool.id;
            const isExpanded = expandedSpoolId === spool.id;
            const isLastRow = idx === filteredSpools.length - 1;

            return (
              <div
                key={spool.id}
                data-spool-id={spool.id}
                style={{ borderBottom: !isLastRow || isLogging || isExpanded ? "1px solid var(--border)" : "none" }}
              >
                {/* Spool row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px minmax(0,1fr) auto 110px auto",
                    alignItems: "center",
                    gap: "12px",
                    padding: "11px 16px",
                  }}
                >
                  {/* Spool visualisation — click to expand */}
                  <div
                    style={{ cursor: "pointer", display: "flex", justifyContent: "center" }}
                    onClick={() => setExpandedSpoolId((id) => (id === spool.id ? null : spool.id))}
                    title={isExpanded ? text(settings.language, "Zuklappen", "Collapse") : text(settings.language, "Details anzeigen", "Show details")}
                  >
                    <SpoolIcon colorHex={spool.colorHex} pct={clampedPct} size={40} />
                  </div>

                  {/* Name + meta */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)" }}>
                        {spool.name}
                      </span>
                      <span
                        className={`badge ${spool.scope === "TEAM" ? "badge-primary" : "badge-neutral"}`}
                        style={{ fontSize: "10.5px" }}
                      >
                        {spool.scope === "TEAM" ? "Geteilt" : "Privat"}
                      </span>
                      {/* Status select inline */}
                      <select
                        className={`badge ${statusBadgeClass(spool.status)}`}
                        value={spool.status}
                        onChange={(e) => void updateSpool(spool.id, { status: e.target.value as FilamentStatus })}
                        style={{
                          cursor: "pointer",
                          appearance: "auto",
                          border: "none",
                          outline: "none",
                          fontWeight: 600,
                          fontSize: "10.5px",
                          padding: "2px 6px",
                          borderRadius: "20px",
                        }}
                      >
                        <option value="FULL">{statusLabel("FULL", settings.language)}</option>
                        <option value="OPEN">{statusLabel("OPEN", settings.language)}</option>
                        <option value="LOW">{statusLabel("LOW", settings.language)}</option>
                        <option value="EMPTY">{statusLabel("EMPTY", settings.language)}</option>
                        <option value="ARCHIVED">{statusLabel("ARCHIVED", settings.language)}</option>
                      </select>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[spool.manufacturer, spool.material, spool.colorName].filter(Boolean).join(" · ")}
                      {spool.location ? ` · 📍 ${spool.location}` : ""}
                    </p>
                  </div>

                  {/* Temp chips (compact, optional) */}
                  <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                    {spool.nozzleTempMinC && spool.nozzleTempMaxC && (
                      <span className="badge badge-neutral" style={{ fontSize: "10.5px" }}>
                        {spool.nozzleTempMinC}–{spool.nozzleTempMaxC}°C
                      </span>
                    )}
                  </div>

                  {/* Fill bar + inline weight edit */}
                  <div>
                    <div
                      style={{
                        height: 5,
                        borderRadius: 3,
                        background: "var(--border)",
                        overflow: "hidden",
                        marginBottom: "3px",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 3,
                          background: barFill,
                          width: clampedPct + "%",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    {remainingEditId === spool.id ? (
                      <input
                        className="input"
                        type="number"
                        value={remainingEditVal}
                        autoFocus
                        style={{ fontSize: "11px", height: "22px", padding: "0 4px", textAlign: "right" }}
                        onChange={(e) => setRemainingEditVal(e.target.value)}
                        onBlur={() => {
                          const val = parseFloat(remainingEditVal);
                          if (!isNaN(val) && val !== spool.remainingWeightGrams) {
                            void updateSpool(spool.id, { remainingWeightGrams: val });
                          }
                          setRemainingEditId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setRemainingEditId(null);
                        }}
                      />
                    ) : (
                      <p
                        title={text(settings.language, "Klicken zum Bearbeiten", "Click to edit")}
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          textAlign: "right",
                          margin: 0,
                          cursor: "text",
                          userSelect: "none",
                        }}
                        onClick={() => {
                          setRemainingEditId(spool.id);
                          setRemainingEditVal(String(spool.remainingWeightGrams ?? ""));
                        }}
                      >
                        {spool.remainingWeightGrams != null ? `${spool.remainingWeightGrams} g` : "— g"}
                      </p>
                    )}
                  </div>

                  {/* Row actions */}
                  <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      title={nfcAvailable ? text(settings.language, "OpenPrintTag auf NFC schreiben", "Write OpenPrintTag to NFC") : text(settings.language, "NFC schreiben, falls der Browser den Leser unterstützt", "NFC write if browser supports the reader")}
                      onClick={() => void startNfcWrite(spool)}
                    >
                      NFC
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      title="OpenPrintTag als QR-Code anzeigen"
                      onClick={() => void showQrCode(spool)}
                    >
                      QR
                    </button>
                    {/* Expand chevron */}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: "4px 5px", color: isExpanded ? "var(--primary)" : "var(--text-soft)" }}
                      onClick={() => setExpandedSpoolId((id) => (id === spool.id ? null : spool.id))}
                      title={isExpanded ? text(settings.language, "Zuklappen", "Collapse") : text(settings.language, "Details", "Details")}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                        {isExpanded
                          ? <path d="M2 8l4-4 4 4H2z"/>
                          : <path d="M2 4l4 4 4-4H2z"/>
                        }
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        if (isLogging) {
                          setLogSpoolId(null);
                        } else {
                          setLogSpoolId(spool.id);
                          setUsageGrams("");
                          setUsageProject("");
                        }
                      }}
                    >
                      Log
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => openEdit(spool)}
                    >
                      {text(settings.language, "Bearbeiten", "Edit")}
                    </button>
                    {deleteConfirmId === spool.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={deleting}
                          onClick={() => void deleteSpool(spool.id)}
                        >
                          {deleting ? "…" : text(settings.language, "Löschen", "Delete")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--text-soft)", padding: "4px 6px" }}
                        onClick={() => setDeleteConfirmId(spool.id)}
                        title={text(settings.language, "Löschen", "Delete")}
                      >
                        ···
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "12px 16px 16px",
                      background: "var(--panel-muted)",
                      borderTop: "1px solid var(--border)",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
                      gap: "14px",
                      fontSize: "12.5px",
                    }}
                  >
                    {/* Print settings */}
                    {(spool.nozzleTempMinC || spool.bedTempC || spool.dryingTempC || spool.flowFactor || spool.densityGcm3) && (
                      <div style={{ display: "grid", gap: "3px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-soft)", margin: "0 0 4px" }}>{text(settings.language, "Druck", "Print")}</p>
                        {spool.nozzleTempMinC && spool.nozzleTempMaxC && <p style={{ color: "var(--text-main)", margin: 0 }}>Nozzle {spool.nozzleTempMinC}–{spool.nozzleTempMaxC}°C</p>}
                        {spool.bedTempC && <p style={{ color: "var(--text-muted)", margin: 0 }}>{text(settings.language, "Bett", "Bed")} {spool.bedTempC}°C</p>}
                        {spool.dryingTempC && <p style={{ color: "var(--text-muted)", margin: 0 }}>{text(settings.language, "Trocknen", "Drying")} {spool.dryingTempC}°C · {spool.dryingHours ?? "?"}h</p>}
                        {spool.flowFactor && <p style={{ color: "var(--text-muted)", margin: 0 }}>Flow {spool.flowFactor}</p>}
                        {spool.densityGcm3 && <p style={{ color: "var(--text-soft)", margin: 0 }}>{spool.densityGcm3} g/cm³</p>}
                      </div>
                    )}

                    {/* Weights */}
                    {(spool.netWeightGrams != null || spool.remainingWeightGrams != null) && (
                      <div style={{ display: "grid", gap: "3px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-soft)", margin: "0 0 4px" }}>{text(settings.language, "Gewicht", "Weight")}</p>
                        {spool.netWeightGrams != null && <p style={{ color: "var(--text-muted)", margin: 0 }}>{text(settings.language, "Netto", "Net")} {spool.netWeightGrams} g</p>}
                        {spool.tareWeightGrams != null && <p style={{ color: "var(--text-soft)", margin: 0 }}>{text(settings.language, "Spule (leer)", "Spool (empty)")} {spool.tareWeightGrams} g</p>}
                        {spool.remainingWeightGrams != null && <p style={{ color: "var(--text-main)", fontWeight: 600, margin: 0 }}>{text(settings.language, "Rest", "Remaining")} {spool.remainingWeightGrams} g</p>}
                      </div>
                    )}

                    {/* Purchase */}
                    {(spool.vendorName || spool.purchaseDate || spool.purchasePriceCents != null || spool.lotNumber) && (
                      <div style={{ display: "grid", gap: "3px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-soft)", margin: "0 0 4px" }}>{text(settings.language, "Einkauf", "Purchase")}</p>
                        {spool.vendorName && <p style={{ color: "var(--text-main)", margin: 0 }}>{spool.vendorName}</p>}
                        {spool.purchaseDate && <p style={{ color: "var(--text-muted)", margin: 0 }}>{new Date(spool.purchaseDate).toLocaleDateString(settings.language === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>}
                        {spool.purchasePriceCents != null && <p style={{ color: "var(--text-muted)", margin: 0 }}>{(spool.purchasePriceCents / 100).toFixed(2)} €</p>}
                        {spool.lotNumber && <p style={{ color: "var(--text-soft)", margin: 0 }}>Lot {spool.lotNumber}</p>}
                      </div>
                    )}

                    {/* Badges + NFC actions — full-width row */}
                    <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                      {spool.notes && (
                        <p style={{ margin: "0 0 6px", flexBasis: "100%", fontSize: "12px", color: "var(--text-soft)", fontStyle: "italic" }}>
                          {spool.notes}
                        </p>
                      )}
                      {spool.barcodeValue && (
                        <span className="badge badge-neutral" style={{ fontSize: "10.5px" }}>{spool.barcodeValue}</span>
                      )}
                      {spool.openPrintTagId && (
                        <span className="badge badge-primary" style={{ fontSize: "10.5px" }}>NFC ✓</span>
                      )}
                      {spool.location && (
                        <span className="badge badge-neutral" style={{ fontSize: "10.5px" }}>📍 {spool.location}</span>
                      )}
                      <div style={{ marginLeft: "auto", display: "flex", gap: "5px" }}>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void showQrCode(spool)}>
                          QR-Code
                        </button>
                        {settings.filamentOpenPrintTagEnabled && (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void copyTagPayload(spool)}>
                            JSON
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Inline usage log */}
                {isLogging && (
                  <div
                    style={{
                      padding: "10px 16px 14px",
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      flexWrap: "wrap",
                      background: "var(--panel-muted)",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12.5px",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {text(settings.language, "Verbrauch loggen:", "Log usage:")}
                    </span>
                    <input
                      className="input"
                      type="number"
                      value={usageGrams}
                      onChange={(e) => setUsageGrams(e.target.value)}
                      placeholder={text(settings.language, "Gramm", "Grams")}
                      style={{ width: "100px" }}
                      autoFocus
                    />
                    <select
                      className="input select"
                      value={usageProject}
                      onChange={(e) => setUsageProject(e.target.value)}
                      style={{ maxWidth: "200px" }}
                    >
                      <option value="">{text(settings.language, "Kein Projekt", "No project")}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!usageGrams}
                      onClick={() => void bookUsage(spool.id)}
                    >
                      {text(settings.language, "Buchen", "Book")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setLogSpoolId(null)}
                    >
                      {text(settings.language, "Abbrechen", "Cancel")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drawer ─────────────────────────────────────────────────────────── */}
      {drawerMode && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              zIndex: 900,
            }}
            onClick={closeDrawer}
          />

          {/* Panel */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(520px, 100vw)",
              background: "var(--panel)",
              borderLeft: "1px solid var(--border)",
              zIndex: 901,
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                top: 0,
                background: "var(--panel)",
                zIndex: 1,
              }}
            >
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                {drawerMode === "add"
                  ? text(settings.language, "Neue Spule", "New spool")
                  : drawerMode === "batch"
                    ? text(settings.language, "Batch-Import", "Batch import")
                    : text(settings.language, `${drawerSpool?.name ?? "Spule"} bearbeiten`, `Edit ${drawerSpool?.name ?? "spool"}`)}
              </h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeDrawer}>
                ✕
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={drawerMode === "add" ? createSpool : drawerMode === "batch" ? createBatch : saveEdit}
              style={{ padding: "20px", display: "grid", gap: "20px", flex: 1 }}
            >
              {/* Batch quantity (batch mode only) */}
              {drawerMode === "batch" && (
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "14px 16px",
                    borderRadius: "8px",
                    background: "var(--panel-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <SectionLabel>{text(settings.language, "Anzahl Spulen", "Number of spools")}</SectionLabel>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={50}
                      value={batchQuantity}
                      onChange={(e) => setBatchQuantity(e.target.value)}
                      style={{ width: "80px" }}
                    />
                    <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: 0 }}>
                      {batchQty > 1
                        ? text(settings.language, `Erstellt ${batchQty} identische Spulen — Name wird automatisch durchnummeriert (#1, #2 …)`, `Creates ${batchQty} identical spools — name will be auto-numbered (#1, #2 …)`)
                        : text(settings.language, "Erstellt eine einzelne Spule.", "Creates a single spool.")}
                    </p>
                  </div>
                </div>
              )}

              {/* Scan + NFC (add/batch mode) */}
              {(drawerMode === "add" || drawerMode === "batch") && (
                <div style={{ display: "grid", gap: "8px" }}>
                  <SectionLabel>{text(settings.language, "Verpackung / Tag einlesen", "Scan packaging / tag")}</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "6px" }}>
                    <input
                      className="input"
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void scanFilamentCode();
                        }
                      }}
                      placeholder={text(settings.language, "Verpackungsbarcode, SKU, QR-Link oder OpenPrintTag scannen", "Scan packaging barcode, SKU, QR link or OpenPrintTag")}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={scanLoading || !scanValue.trim()}
                      onClick={() => void scanFilamentCode()}
                    >
                      {scanLoading ? "…" : "Scan"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title={text(settings.language, "Barcode per Kamera, USB-Scanner oder Tastatureingabe lesen", "Read barcode via camera, USB scanner or keyboard input")}
                      onClick={openBarcodeReader}
                    >
                      {text(settings.language, "Barcode lesen", "Read barcode")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title={text(settings.language, "NFC-Tag einlesen", "Read NFC tag")}
                      onClick={() => void startNfcRead()}
                    >
                      NFC
                    </button>
                  </div>
                </div>
              )}

              {/* ── Grunddaten ── */}
              <div style={{ display: "grid", gap: "10px" }}>
                <SectionLabel>{text(settings.language, "Grunddaten", "Basic data")}</SectionLabel>
                <Field label={text(settings.language, "Sichtbarkeit", "Visibility")}>
                  <select
                    className="input select"
                    value={form.scope}
                    onChange={(e) => setForm((c) => ({ ...c, scope: e.target.value as FilamentScope }))}
                  >
                    <option value="PRIVATE">{text(settings.language, "Privat", "Private")}</option>
                    <option value="TEAM">{text(settings.language, "Geteilt", "Shared")}</option>
                  </select>
                </Field>
                <Field label={text(settings.language, "Name *", "Name *")}>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                    placeholder={text(settings.language, "z.B. PLA Matt Schwarz", "e.g. PLA Matte Black")}
                    required
                  />
                </Field>
                <FieldGrid cols={2}>
                  <Field label={text(settings.language, "Hersteller", "Manufacturer")}>
                    <input
                      className="input"
                      value={form.manufacturer}
                      onChange={(e) => setForm((c) => ({ ...c, manufacturer: e.target.value }))}
                    />
                  </Field>
                  <Field label={text(settings.language, "Material *", "Material *")}>
                    <MaterialCombobox
                      value={form.material}
                      suggestions={materialSuggestions}
                      onInputChange={(material) => setForm((c) => ({ ...c, material }))}
                      onSelect={applyMaterialSuggestion}
                      placeholder={text(settings.language, "Material wählen oder frei eingeben", "Select material or type freely")}
                    />
                  </Field>
                </FieldGrid>
                <FieldGrid cols={2}>
                  <Field label={text(settings.language, "Farbname", "Color name")}>
                    <input
                      className="input"
                      value={form.colorName}
                      onChange={(e) => setForm((c) => ({ ...c, colorName: e.target.value }))}
                    />
                  </Field>
                  <Field label={text(settings.language, "Farbe", "Color")}>
                    <input
                      className="input"
                      type="color"
                      value={form.colorHex}
                      onChange={(e) => setForm((c) => ({ ...c, colorHex: e.target.value }))}
                      style={{ height: 38, cursor: "pointer" }}
                    />
                  </Field>
                </FieldGrid>
                <Field label={text(settings.language, "Lagerort", "Storage location")}>
                  <input
                    className="input"
                    value={form.location}
                    onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
                    placeholder={text(settings.language, "z.B. Regal A2", "e.g. Shelf A2")}
                  />
                </Field>
              </div>

              {/* ── Gewichte ── */}
              <div style={{ display: "grid", gap: "10px" }}>
                <SectionLabel>Gewichte</SectionLabel>
                <FieldGrid cols={3}>
                  <Field label="Netto g">
                    <input
                      className="input"
                      type="number"
                      value={form.netWeightGrams}
                      onChange={(e) => setForm((c) => ({ ...c, netWeightGrams: e.target.value }))}
                    />
                  </Field>
                  <Field label="Spulengewicht leer (g)">
                    <input
                      className="input"
                      type="number"
                      value={form.tareWeightGrams}
                      onChange={(e) => setForm((c) => ({ ...c, tareWeightGrams: e.target.value }))}
                    />
                  </Field>
                  <Field label="Rest g">
                    <input
                      className="input"
                      type="number"
                      value={form.remainingWeightGrams}
                      onChange={(e) => setForm((c) => ({ ...c, remainingWeightGrams: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
                <FieldGrid cols={2}>
                  <Field label="Dichte g/cm³">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={form.densityGcm3}
                      onChange={(e) => setForm((c) => ({ ...c, densityGcm3: e.target.value }))}
                    />
                  </Field>
                  <Field label="Flow-Faktor">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={form.flowFactor}
                      onChange={(e) => setForm((c) => ({ ...c, flowFactor: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
              </div>

              {/* ── Druckeinstellungen ── */}
              <div style={{ display: "grid", gap: "10px" }}>
                <SectionLabel>Druckeinstellungen</SectionLabel>
                <FieldGrid cols={3}>
                  <Field label="Nozzle min °C">
                    <input
                      className="input"
                      type="number"
                      value={form.nozzleTempMinC}
                      onChange={(e) => setForm((c) => ({ ...c, nozzleTempMinC: e.target.value }))}
                    />
                  </Field>
                  <Field label="Nozzle max °C">
                    <input
                      className="input"
                      type="number"
                      value={form.nozzleTempMaxC}
                      onChange={(e) => setForm((c) => ({ ...c, nozzleTempMaxC: e.target.value }))}
                    />
                  </Field>
                  <Field label="Bett °C">
                    <input
                      className="input"
                      type="number"
                      value={form.bedTempC}
                      onChange={(e) => setForm((c) => ({ ...c, bedTempC: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
                <FieldGrid cols={2}>
                  <Field label="Trocknen °C">
                    <input
                      className="input"
                      type="number"
                      value={form.dryingTempC}
                      onChange={(e) => setForm((c) => ({ ...c, dryingTempC: e.target.value }))}
                    />
                  </Field>
                  <Field label="Trocknen h">
                    <input
                      className="input"
                      type="number"
                      step="0.5"
                      value={form.dryingHours}
                      onChange={(e) => setForm((c) => ({ ...c, dryingHours: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
              </div>

              {/* ── Einkauf ── */}
              <div style={{ display: "grid", gap: "10px" }}>
                <SectionLabel>Einkauf</SectionLabel>
                <FieldGrid cols={2}>
                  <Field label="Händler">
                    <input
                      className="input"
                      value={form.vendorName}
                      onChange={(e) => setForm((c) => ({ ...c, vendorName: e.target.value }))}
                    />
                  </Field>
                  <Field label="Kaufdatum">
                    <input
                      className="input"
                      type="date"
                      value={form.purchaseDate}
                      onChange={(e) => setForm((c) => ({ ...c, purchaseDate: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
                <FieldGrid cols={2}>
                  <Field label="Preis (Cent)">
                    <input
                      className="input"
                      type="number"
                      value={form.purchasePriceCents}
                      onChange={(e) => setForm((c) => ({ ...c, purchasePriceCents: e.target.value }))}
                    />
                  </Field>
                  <Field label="Lot / Batch">
                    <input
                      className="input"
                      value={form.lotNumber}
                      onChange={(e) => setForm((c) => ({ ...c, lotNumber: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
                <FieldGrid cols={2}>
                  <Field label="Serie">
                    <input
                      className="input"
                      value={form.filamentSeries}
                      onChange={(e) => setForm((c) => ({ ...c, filamentSeries: e.target.value }))}
                    />
                  </Field>
                  <Field label="SKU">
                    <input
                      className="input"
                      value={form.manufacturerSku}
                      onChange={(e) => setForm((c) => ({ ...c, manufacturerSku: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
              </div>

              {/* ── Erweitert ── */}
              <div style={{ display: "grid", gap: "10px" }}>
                <SectionLabel>Erweitert</SectionLabel>
                <FieldGrid cols={2}>
                  <Field label="Barcode-Wert">
                    <input
                      className="input"
                      value={form.barcodeValue}
                      onChange={(e) => setForm((c) => ({ ...c, barcodeValue: e.target.value }))}
                    />
                  </Field>
                  <Field label="Hersteller-URL">
                    <input
                      className="input"
                      value={form.externalSpoolUrl}
                      onChange={(e) => setForm((c) => ({ ...c, externalSpoolUrl: e.target.value }))}
                    />
                  </Field>
                </FieldGrid>
                <Field label="Notizen">
                  <textarea
                    className="input"
                    value={form.notes}
                    onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                    rows={3}
                  />
                </Field>
              </div>

              {/* ── Verlauf (edit only) ── */}
              {drawerMode === "edit" && (
                <div style={{ display: "grid", gap: "10px" }}>
                  <SectionLabel>Verbrauchsverlauf</SectionLabel>
                  {historyLoading ? (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Wird geladen…</p>
                  ) : historyEntries.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-soft)" }}>Noch keine Einträge.</p>
                  ) : (
                    <div style={{ display: "grid", gap: "5px" }}>
                      {historyEntries.slice(0, 10).map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            background: "var(--panel-muted)",
                            fontSize: "12.5px",
                          }}
                        >
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <strong style={{ color: "var(--danger)" }}>−{entry.gramsUsed} g</strong>
                            {entry.projectTitle && (
                              <span className="badge badge-neutral" style={{ fontSize: "11px" }}>
                                {entry.projectTitle}
                              </span>
                            )}
                            {entry.note && (
                              <span style={{ color: "var(--text-soft)" }}>{entry.note}</span>
                            )}
                          </div>
                          <span
                            style={{
                              color: "var(--text-soft)",
                              whiteSpace: "nowrap",
                              fontSize: "11.5px",
                            }}
                          >
                            {new Date(entry.createdAt).toLocaleDateString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {entry.userName ? ` · ${entry.userName}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Submit row ── */}
              <div style={{ display: "flex", gap: "8px", paddingTop: "4px", flexWrap: "wrap" }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving
                    ? text(settings.language, "Speichert…", "Saving…")
                    : drawerMode === "add"
                      ? text(settings.language, "Spule anlegen", "Add spool")
                      : drawerMode === "batch"
                        ? text(settings.language, `${batchQty} Spule${batchQty !== 1 ? "n" : ""} anlegen`, `Add ${batchQty} spool${batchQty !== 1 ? "s" : ""}`)
                        : text(settings.language, "Speichern", "Save")}
                </button>
                {drawerMode === "edit" && drawerSpool && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Spule auf NFC-Tag schreiben"
                      onClick={() => void startNfcWrite(drawerSpool)}
                    >
                      NFC schreiben
                    </button>
                    {settings.filamentOpenPrintTagEnabled && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void copyTagPayload(drawerSpool)}
                      >
                        JSON kopieren
                      </button>
                    )}
                  </>
                )}
                <button type="button" className="btn btn-ghost" onClick={closeDrawer}>
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Barcode reader modal ─────────────────────────────────────────── */}
      {barcodeReaderOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.58)",
            zIndex: 1085,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeBarcodeReader();
          }}
        >
          <div className="panel" style={{ width: "min(560px, 100%)", padding: 20, display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Barcode lesen</h3>
                <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
                  Verpackungsbarcode scannen oder einfügen. Er wird direkt in die Spulen-Daten übernommen.
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeBarcodeReader}>
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <SectionLabel>Scanner-Eingabe</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  id="filament-barcode-reader-input"
                  className="input"
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void applyBarcodeReaderValue(scanValue);
                    }
                  }}
                  placeholder="Barcode scannen oder einfügen"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={scanLoading || !isReadableBarcodeValue(scanValue)}
                  onClick={() => void applyBarcodeReaderValue(scanValue)}
                >
                  Übernehmen
                </button>
              </div>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12.5 }}>
                Handscanner senden meist automatisch Enter. Alternativ den Wert einfügen und übernehmen.
              </p>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <SectionLabel>Kamera</SectionLabel>
                {barcodeCameraActive ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={stopBarcodeCamera}>
                    Kamera stoppen
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void startBarcodeCamera()}>
                    Kamera starten
                  </button>
                )}
              </div>
              <video
                ref={barcodeVideoRef}
                muted
                playsInline
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  borderRadius: 8,
                  background: "var(--panel-muted)",
                  border: "1px solid var(--border)",
                  objectFit: "cover",
                  display: barcodeCameraActive ? "block" : "none",
                }}
              />
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>{barcodeReaderMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── QR fallback modal ─────────────────────────────────────────────── */}
      {qrModal && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.58)",
              zIndex: 1090,
              backdropFilter: "blur(2px)",
            }}
            onClick={() => setQrModal(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="OpenPrintTag QR-Code"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1091,
              width: "min(420px, calc(100vw - 28px))",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-lg)",
              padding: "18px",
              display: "grid",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text-main)" }}>
                  OpenPrintTag QR
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
                  {qrModal.spool.name}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQrModal(null)}>
                ✕
              </button>
            </div>

            <div
              style={{
                background: "#ffffff",
                borderRadius: "10px",
                padding: "14px",
                display: "grid",
                placeItems: "center",
              }}
            >
              <img src={qrModal.qrCode} alt={`OpenPrintTag QR-Code für ${qrModal.spool.name}`} style={{ width: "100%", maxWidth: 300, display: "block" }} />
            </div>

            <div style={{ display: "grid", gap: "6px", fontSize: "12.5px", color: "var(--text-muted)" }}>
              <p style={{ margin: 0 }}>
                Der QR-Code enthält die Spulen-URL und den OpenPrintTag-Payload. Er ist der Fallback, wenn NFC im Browser
                oder mit deinem Reader nicht schreiben kann.
              </p>
              <code
                style={{
                  display: "block",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "var(--panel-muted)",
                  border: "1px solid var(--border)",
                  color: "var(--text-soft)",
                  overflowWrap: "anywhere",
                }}
              >
                {qrModal.tagUrl}
              </code>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={() => void copyTagPayload(qrModal.spool)}>
                JSON kopieren
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(qrModal.tagUrl).then(
                    () => toast("Tag-Link kopiert.", "success"),
                    () => toast("Clipboard nicht verfügbar.", "error"),
                  );
                }}
              >
                Link kopieren
              </button>
              <a className="btn btn-ghost" href={qrModal.qrCode} download={`${qrModal.spool.name.replace(/[^a-z0-9_-]+/gi, "_")}-openprinttag-qr.png`}>
                PNG
              </a>
            </div>
          </div>
        </>
      )}

      {/* ── NFC overlay ────────────────────────────────────────────────────── */}
      {nfcMode && <NfcOverlay mode={nfcMode} onCancel={cancelNfc} />}
    </div>
  );
}
