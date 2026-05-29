"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

import { buildOpenPrintTagPayload } from "@/src/lib/filament-core.mjs";

type NdefReaderConstructor = new () => {
  scan: () => Promise<void>;
  write: (message: string | { records: Array<{ recordType: string; data?: string; lang?: string }> }) => Promise<void>;
  onreading: ((event: { serialNumber?: string; message: { records: Array<{ recordType: string; data?: DataView; encoding?: string; lang?: string }> } }) => void) | null;
  onreadingerror: (() => void) | null;
};

type OpenPrintWindow = Window & typeof globalThis & { NDEFReader?: NdefReaderConstructor };

type PrototypeForm = {
  name: string;
  manufacturer: string;
  material: string;
  colorName: string;
  colorHex: string;
  diameterMm: string;
  netWeightGrams: string;
  tareWeightGrams: string;
  remainingWeightGrams: string;
  location: string;
  scope: "PRIVATE" | "TEAM";
};

const initialForm: PrototypeForm = {
  name: "PLA Matt Schwarz",
  manufacturer: "N3DP Demo",
  material: "PLA",
  colorName: "Matt Schwarz",
  colorHex: "#111827",
  diameterMm: "1.75",
  netWeightGrams: "1000",
  tareWeightGrams: "250",
  remainingWeightGrams: "840",
  location: "Regal A2 / Trockenbox 1",
  scope: "TEAM",
};

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function makePrototypeTagId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `opt-proto-${crypto.randomUUID()}`;
  return `opt-proto-${Date.now().toString(36)}`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function OpenPrintTagPrototypeClient() {
  const [form, setForm] = useState<PrototypeForm>(initialForm);
  const [tagId, setTagId] = useState(() => makePrototypeTagId());
  const [baseUrl] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [qrCode, setQrCode] = useState("");
  const [nfcState] = useState<"available" | "missing">(() => (typeof window !== "undefined" && "NDEFReader" in window ? "available" : "missing"));
  const [activity, setActivity] = useState("Bereit.");
  const [lastRead, setLastRead] = useState("");

  const tagUrl = `${baseUrl || "https://makershelf.local"}/filament/tag/${tagId}`;
  const payload = useMemo(() => {
    return buildOpenPrintTagPayload({
      id: tagId,
      openPrintTagId: tagId,
      openPrintTagVersion: "0.1-prototype",
      name: form.name,
      manufacturer: form.manufacturer,
      material: form.material,
      colorName: form.colorName,
      colorHex: form.colorHex,
      diameterMm: numeric(form.diameterMm) ?? 1.75,
      netWeightGrams: numeric(form.netWeightGrams),
      tareWeightGrams: numeric(form.tareWeightGrams),
      remainingWeightGrams: numeric(form.remainingWeightGrams),
      location: form.location,
      scope: form.scope,
    });
  }, [form, tagId]);
  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const ndefMessage = useMemo(
    () => ({
      records: [
        { recordType: "url", data: tagUrl },
        { recordType: "text", data: payloadJson, lang: "de" },
      ],
    }),
    [payloadJson, tagUrl],
  );

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(tagUrl, { margin: 2, scale: 7, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((dataUrl) => { if (!cancelled) setQrCode(dataUrl); })
      .catch(() => { if (!cancelled) setQrCode(""); });
    return () => { cancelled = true; };
  }, [tagUrl]);

  function update<K extends keyof PrototypeForm>(key: K, value: PrototypeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function copyPayload() {
    await navigator.clipboard.writeText(payloadJson);
    setActivity("Payload in die Zwischenablage kopiert.");
  }

  async function writeNfc() {
    const NDEFReader = (window as OpenPrintWindow).NDEFReader;
    if (!NDEFReader) {
      setActivity("Dieses Browserprofil kann Web NFC nicht schreiben. QR/JSON-Fallback ist bereit.");
      return;
    }
    try {
      setActivity("NFC-Schreibvorgang gestartet. Tag an das Geraet halten.");
      const writer = new NDEFReader();
      await writer.write(ndefMessage);
      setActivity("NFC-Tag wurde mit URL und OpenPrintTag-Payload beschrieben.");
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "NFC-Schreiben wurde abgebrochen.");
    }
  }

  async function readNfc() {
    const NDEFReader = (window as OpenPrintWindow).NDEFReader;
    if (!NDEFReader) {
      setActivity("Dieses Browserprofil kann Web NFC nicht lesen. QR/JSON-Fallback ist bereit.");
      return;
    }
    try {
      setActivity("NFC-Lesen gestartet. Tag an das Geraet halten.");
      const reader = new NDEFReader();
      reader.onreading = (event) => {
        const decoded = event.message.records
          .map((record) => {
            if (!record.data) return `[${record.recordType}]`;
            return new TextDecoder(record.encoding || "utf-8").decode(record.data);
          })
          .join("\n\n");
        setLastRead(decoded || `Tag gelesen: ${event.serialNumber || "ohne Seriennummer"}`);
        setActivity("NFC-Tag gelesen.");
      };
      reader.onreadingerror = () => setActivity("NFC-Tag konnte nicht gelesen werden.");
      await reader.scan();
    } catch (error) {
      setActivity(error instanceof Error ? error.message : "NFC-Lesen wurde abgebrochen.");
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header" style={{ marginBottom: "18px" }}>
        <div>
          <p className="eyebrow">Hidden Prototype</p>
          <h1>OpenPrintTag Studio</h1>
          <p className="page-subtitle">
            Fertiger Prototyp für Filament-Tags: Payload bauen, QR nutzen, JSON exportieren und Web-NFC testen, ohne Eintrag in der Produktivnavigation.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setTagId(makePrototypeTagId())}>
          Neue Tag-ID
        </button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px", alignItems: "start" }}>
        <div className="panel panel-padded">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">Spool-Daten</p>
              <h2 style={{ fontSize: "20px", fontWeight: 800, marginTop: "4px" }}>Tag vorbereiten</h2>
            </div>
            <span className={`badge ${form.scope === "TEAM" ? "badge-primary" : "badge-neutral"}`}>
              {form.scope === "TEAM" ? "Team Share" : "Pro Person"}
            </span>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <input className="input" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Spulenname" />
              <input className="input" value={form.manufacturer} onChange={(event) => update("manufacturer", event.target.value)} placeholder="Hersteller" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 70px", gap: "10px" }}>
              <input className="input" value={form.material} onChange={(event) => update("material", event.target.value.toUpperCase())} placeholder="Material" />
              <input className="input" value={form.colorName} onChange={(event) => update("colorName", event.target.value)} placeholder="Farbe" />
              <input className="input" type="color" value={form.colorHex} onChange={(event) => update("colorHex", event.target.value)} style={{ height: 38 }} />
            </div>
            <input className="input" value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Ort, z.B. Regal A2 / Trockenbox 1" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              <input className="input" type="number" step="0.01" value={form.diameterMm} onChange={(event) => update("diameterMm", event.target.value)} placeholder="Durchmesser" />
              <input className="input" type="number" value={form.netWeightGrams} onChange={(event) => update("netWeightGrams", event.target.value)} placeholder="Netto g" />
              <input className="input" type="number" value={form.tareWeightGrams} onChange={(event) => update("tareWeightGrams", event.target.value)} placeholder="Tara g" />
              <input className="input" type="number" value={form.remainingWeightGrams} onChange={(event) => update("remainingWeightGrams", event.target.value)} placeholder="Rest g" />
            </div>
            <select className="input select" value={form.scope} onChange={(event) => update("scope", event.target.value as PrototypeForm["scope"])}>
              <option value="PRIVATE">Pro Person</option>
              <option value="TEAM">Team Share</option>
            </select>
          </div>
        </div>

        <aside className="panel panel-padded">
          <p className="eyebrow">Tag-Link</p>
          <div style={{ display: "grid", gridTemplateColumns: "148px 1fr", gap: "14px", alignItems: "center", marginTop: "10px" }}>
            <div style={{ background: "#fff", borderRadius: "8px", padding: "8px", border: "1px solid var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qrCode ? <img src={qrCode} alt="OpenPrintTag QR" style={{ width: "100%", display: "block" }} /> : null}
            </div>
            <div>
              <p style={{ fontWeight: 800, wordBreak: "break-word" }}>{tagId}</p>
              <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", wordBreak: "break-all" }}>{tagUrl}</p>
              <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-muted)" }}>
                Web NFC: {nfcState === "available" ? "verfügbar" : nfcState === "missing" ? "nicht verfügbar, Fallback aktiv" : "wird geprüft"}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "16px", alignItems: "start", marginTop: "16px" }}>
        <div className="panel panel-padded">
          <p className="eyebrow">Aktionen</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
            <button type="button" className="btn btn-primary" onClick={() => void writeNfc()}>NFC schreiben</button>
            <button type="button" className="btn btn-secondary" onClick={() => void readNfc()}>NFC lesen</button>
            <button type="button" className="btn btn-secondary" onClick={() => void copyPayload()}>Payload kopieren</button>
            <button type="button" className="btn btn-secondary" onClick={() => downloadFile(`${tagId}.json`, payloadJson, "application/json")}>JSON exportieren</button>
          </div>
          <div style={{ marginTop: "14px", padding: "12px", borderRadius: "8px", background: "var(--panel-muted)", color: "var(--text-muted)", fontSize: "13px" }}>
            {activity}
          </div>
          {lastRead && (
            <pre style={{ marginTop: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", background: "var(--panel)" }}>
              {lastRead}
            </pre>
          )}
        </div>

        <div className="panel panel-padded">
          <p className="eyebrow">OpenPrintTag Payload</p>
          <pre style={{ marginTop: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", background: "var(--panel-muted)", maxHeight: 420, overflow: "auto" }}>
            {payloadJson}
          </pre>
        </div>
      </section>
    </main>
  );
}
