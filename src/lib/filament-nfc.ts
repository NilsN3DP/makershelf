/**
 * Web NFC utilities for OpenPrintTag read/write.
 * Wraps the NDEFReader API (Chrome on Android + some desktop with NFC hardware).
 * Safe to import in SSR — all browser checks are guarded.
 */

// ─── Type declarations for Web NFC ───────────────────────────────────────────

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  encoding?: string;
  lang?: string;
  data?: DataView;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent {
  serialNumber?: string;
  message: NDEFMessage;
}

interface NDEFWriteMessage {
  records: Array<{
    recordType: string;
    data?: string | BufferSource;
    lang?: string;
    mediaType?: string;
    encoding?: string;
  }>;
}

interface NDEFReader {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: string | NDEFWriteMessage, options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}

declare global {
  interface Window {
    NDEFReader?: new () => NDEFReader;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type NfcReadResult =
  | { ok: true; type: "openprinttag"; payload: Record<string, unknown>; serialNumber?: string }
  | { ok: true; type: "url"; url: string; serialNumber?: string }
  | { ok: true; type: "text"; text: string; serialNumber?: string }
  | { ok: false; error: string };

/** Returns true only when Web NFC is actually available (client-side, HTTPS, Chrome). */
export function isNfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

/**
 * Start scanning for an NFC tag.
 * Resolves with the first successfully parsed record.
 * Rejects after `timeoutMs` (default 30 s) or if the caller aborts via `signal`.
 */
export function readNfcTag(signal?: AbortSignal, timeoutMs = 30_000): Promise<NfcReadResult> {
  return new Promise((resolve, reject) => {
    if (!window.NDEFReader) {
      reject(new Error("Web NFC wird von diesem Browser/Gerät nicht unterstützt."));
      return;
    }

    const reader = new window.NDEFReader();

    const timer = setTimeout(() => {
      reject(new Error("Kein NFC-Tag erkannt (Timeout)."));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      reader.onreading = null;
      reader.onreadingerror = null;
    }

    signal?.addEventListener("abort", () => {
      cleanup();
      reject(new DOMException("NFC-Lesen abgebrochen.", "AbortError"));
    });

    reader.onreading = (event: NDEFReadingEvent) => {
      cleanup();
      resolve(parseNdefMessage(event.message, event.serialNumber));
    };

    reader.onreadingerror = () => {
      cleanup();
      resolve({ ok: false, error: "NFC-Tag konnte nicht gelesen werden." });
    };

    reader.scan({ signal }).catch((err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err : new Error("NFC-Scan fehlgeschlagen."));
    });
  });
}

/**
 * Write an OpenPrintTag payload (+ URL record) to the next tapped NFC tag.
 * Resolves when the write completes; rejects on error or abort.
 */
export async function writeNfcTag(
  payload: Record<string, unknown>,
  tagUrl: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!window.NDEFReader) {
    throw new Error("Web NFC wird von diesem Browser/Gerät nicht unterstützt.");
  }
  const writer = new window.NDEFReader();
  await writer.write(
    {
      records: [
        { recordType: "url", data: tagUrl },
        { recordType: "text", data: JSON.stringify(payload), lang: "de", encoding: "utf-8" },
      ],
    },
    { signal },
  );
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function decodeRecord(record: NDEFRecord): string | null {
  if (!record.data) return null;
  try {
    return new TextDecoder(record.encoding ?? "utf-8").decode(record.data);
  } catch {
    return null;
  }
}

function parseNdefMessage(message: NDEFMessage, serialNumber?: string): NfcReadResult {
  for (const record of message.records) {
    // JSON text record — primary OpenPrintTag carrier
    if (record.recordType === "text") {
      const text = decodeRecord(record);
      if (text) {
        try {
          const json = JSON.parse(text) as Record<string, unknown>;
          if (json.schema === "org.openprinttag.spool") {
            return { ok: true, type: "openprinttag", payload: json, serialNumber };
          }
        } catch {
          // not JSON — fall through
        }
        return { ok: true, type: "text", text, serialNumber };
      }
    }

    // MIME/JSON record (alternative carrier format)
    if (record.recordType === "mime" && record.mediaType === "application/json") {
      const text = decodeRecord(record);
      if (text) {
        try {
          const json = JSON.parse(text) as Record<string, unknown>;
          return { ok: true, type: "openprinttag", payload: json, serialNumber };
        } catch {
          // not JSON
        }
      }
    }

    // URL record — pass back so caller can feed it to the scan API
    if (record.recordType === "url") {
      const url = decodeRecord(record);
      if (url) return { ok: true, type: "url", url, serialNumber };
    }
  }

  return { ok: false, error: "Kein lesbarer Datensatz auf diesem NFC-Tag." };
}

/**
 * Map an OpenPrintTag spool object to the filament form field structure.
 * Only fills fields that are present in the payload; caller merges with existing form state.
 */
export function openPrintTagToFormFields(payload: Record<string, unknown>): Record<string, unknown> {
  const spool = (payload.spool ?? payload) as Record<string, unknown>;
  const printProfile = (spool.printProfile ?? {}) as Record<string, unknown>;
  const materialProfile = (spool.materialProfile ?? {}) as Record<string, unknown>;
  const barcode = (spool.barcode ?? {}) as Record<string, unknown>;

  function str(v: unknown) {
    return typeof v === "string" && v ? v : undefined;
  }
  function num(v: unknown) {
    return typeof v === "number" && Number.isFinite(v) ? String(v) : undefined;
  }

  return Object.fromEntries(
    Object.entries({
      name: str(spool.name),
      manufacturer: str(spool.manufacturer),
      filamentSeries: str(spool.filamentSeries),
      manufacturerSku: str(spool.manufacturerSku),
      vendorName: str(spool.vendorName),
      purchaseDate: str(spool.purchaseDate),
      lotNumber: str(spool.lotNumber),
      material: str(spool.material),
      colorName: str(spool.colorName),
      colorHex: str(spool.colorHex),
      location: str(spool.location),
      netWeightGrams: num(spool.netWeightGrams),
      tareWeightGrams: num(spool.tareWeightGrams),
      remainingWeightGrams: num(spool.remainingWeightGrams),
      densityGcm3: num(materialProfile.densityGcm3),
      flowFactor: num(materialProfile.flowFactor),
      nozzleTempMinC: num(printProfile.nozzleTempMinC),
      nozzleTempMaxC: num(printProfile.nozzleTempMaxC),
      bedTempC: num(printProfile.bedTempC),
      dryingTempC: num(printProfile.dryingTempC),
      dryingHours: num(printProfile.dryingHours),
      barcodeValue: str(barcode.value),
      externalSpoolUrl: str(spool.externalSpoolUrl),
    }).filter(([, v]) => v !== undefined),
  );
}
