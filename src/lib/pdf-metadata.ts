type PdfMetadata = {
  sourceUrl?: string;
  text?: string;
};

const URL_PATTERN = /https?:\/\/[^\s<>)\]"']+/gi;

function decodePdfString(value: string) {
  return value
    .replace(/\\([nrtbf])/g, " ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\\r?\n/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(candidate: string) {
  const cleaned = decodePdfString(candidate)
    .replace(/[),.;]+$/g, "")
    .trim();

  const printablesModel = cleaned.match(/https?:\/\/(?:www\.)?printables\.com\/model\/(\d+)/i);
  if (printablesModel?.[1]) {
    return `https://www.printables.com/model/${printablesModel[1]}`;
  }

  return cleaned;
}

function pickBestSourceUrl(urls: string[]) {
  const normalized = Array.from(new Set(urls.map(normalizeUrl).filter(Boolean)));

  return (
    normalized.find((url) => /printables\.com\/model\/\d+/i.test(url)) ||
    normalized.find((url) => /\/model\//i.test(url)) ||
    normalized.find((url) => !/[?&]categoryId=/i.test(url)) ||
    normalized[0] ||
    ""
  );
}

function collectUrls(text: string) {
  return Array.from(text.matchAll(URL_PATTERN), (match) => match[0]);
}

function extractLiteralStrings(text: string) {
  return Array.from(text.matchAll(/\((?:\\.|[^\\)]){3,}\)/g), (match) =>
    decodePdfString(match[0].slice(1, -1)),
  )
    .filter((value) => /[a-zA-Z0-9]/.test(value))
    .join("\n");
}

async function inflatePdfStream(streamBytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    return "";
  }

  try {
    const stream = new DecompressionStream("deflate");
    const writer = stream.writable.getWriter();
    const chunk = new Uint8Array(streamBytes.byteLength);
    chunk.set(streamBytes);
    await Promise.race([
      writer.write(chunk),
      new Promise((_, reject) => {
        globalThis.setTimeout(() => reject(new Error("PDF stream timeout")), 500);
      }),
    ]);
    await Promise.race([
      writer.close(),
      new Promise((_, reject) => {
        globalThis.setTimeout(() => reject(new Error("PDF stream timeout")), 500);
      }),
    ]);
    const inflated = await Promise.race([
      new Response(stream.readable).arrayBuffer(),
      new Promise<ArrayBuffer>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error("PDF stream timeout")), 500);
      }),
    ]);
    return new TextDecoder("utf-8", { fatal: false }).decode(inflated);
  } catch {
    return "";
  }
}

function findPdfStreams(rawText: string, bytes: Uint8Array) {
  const streams: Uint8Array[] = [];
  const pattern = /stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawText))) {
    const contentStart = match.index + match[0].length;
    const endIndex = rawText.indexOf("endstream", contentStart);
    if (endIndex === -1) {
      break;
    }

    const streamDictionary = rawText.slice(Math.max(0, match.index - 800), match.index);
    if (!/\/FlateDecode\b/i.test(streamDictionary)) {
      pattern.lastIndex = endIndex + "endstream".length;
      continue;
    }

    let contentEnd = endIndex;
    while (contentEnd > contentStart && (rawText[contentEnd - 1] === "\n" || rawText[contentEnd - 1] === "\r")) {
      contentEnd -= 1;
    }

    streams.push(bytes.slice(contentStart, contentEnd));
    pattern.lastIndex = endIndex + "endstream".length;
  }

  return streams;
}

export function isPdfMetadataFile(file: File) {
  return file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
}

export async function extractPdfMetadata(file: File): Promise<PdfMetadata | undefined> {
  if (!isPdfMetadataFile(file)) {
    return undefined;
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rawText = new TextDecoder("latin1").decode(bytes);
    const chunks = [rawText];

    for (const streamBytes of findPdfStreams(rawText, bytes).slice(0, 80)) {
      const inflated = await inflatePdfStream(streamBytes);
      if (inflated) {
        chunks.push(inflated);
      }
    }

    const combined = chunks.join("\n");
    const literalText = extractLiteralStrings(combined);
    const sourceUrl = pickBestSourceUrl(collectUrls(combined));

    if (!sourceUrl && !literalText) {
      return undefined;
    }

    return {
      sourceUrl,
      text: literalText,
    };
  } catch {
    return undefined;
  }
}
