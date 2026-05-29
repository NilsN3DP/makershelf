import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { NextRequest, NextResponse } from "next/server";

import { detectSourcePlatform, licenseOptions } from "@/src/lib/makershelf-data";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { isPrivateHostname } from "@/src/lib/server/ssrf-protection";

type JsonObject = Record<string, unknown>;

type PrintablesGraphQlFile = {
  id?: string;
  name?: string;
  folder?: string;
};

type PrintablesGraphQlImportData = {
  category?: string;
  license?: string;
  fileLinks: string[];
};

const remoteProjectFileExtensionPattern =
  String.raw`(?:stl|obj|3mf|step|stp|gcode|amf|ply|pdf|zipx?|rar|7z|tar(?:\.(?:gz|bz2|xz|zst|lz|lzma))?|tgz|tbz2?|txz|tzst|tlz|gz|bz2|xz|zst|lz|lzma|lz4|cab|iso)`;

const supportedRemoteFileRegex = new RegExp(
  String.raw`\.${remoteProjectFileExtensionPattern}(?:[?#].*)?$`,
  "i",
);

const printablesLicenseIdMap: Record<string, string> = {
  "1": "CC BY 4.0",
  "2": "CC BY-SA 4.0",
  "3": "CC BY-ND 4.0",
  "4": "CC BY-NC 4.0",
  "5": "CC BY-NC-SA 4.0",
  "6": "CC BY-NC-ND 4.0",
  "7": "CC0 1.0",
  "13": "Standard Digital File License",
};

const printablesDownloadTypeByKey: Record<string, "gcode" | "other" | "sla" | "stl"> = {
  gcodes: "gcode",
  otherFiles: "other",
  slas: "sla",
  stls: "stl",
};

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function absoluteUrl(candidate: string | undefined, baseUrl: string) {
  if (!candidate) return undefined;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

function getPrintablesModelId(finalUrl: string, html: string) {
  const urlMatch = finalUrl.match(/\/model\/(\d+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const model = extractPrintablesModelData(html);
  const id = model?.id;
  if (typeof id === "string" || typeof id === "number") {
    return String(id);
  }
}

function withDownloadFilename(url: string, file: PrintablesGraphQlFile) {
  const filename = [file.folder, file.name].filter(Boolean).join("/") || file.name || "";
  if (!filename) {
    return url;
  }
  const parsed = new URL(url);
  parsed.hash = `filename=${encodeURIComponent(filename)}`;
  return parsed.toString();
}

async function printablesGraphQl<T>(query: string, variables: JsonObject): Promise<T | undefined> {
  try {
    const response = await fetch("https://api.printables.com/graphql/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://www.printables.com",
        Referer: "https://www.printables.com/",
        "User-Agent": "makershelf metadata importer",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as { data?: T };
    return payload.data;
  } catch {
    return undefined;
  }
}

async function getPrintablesDownloadLink(
  modelId: string,
  id: string,
  fileType: "gcode" | "other" | "pack" | "sla" | "stl",
) {
  const data = await printablesGraphQl<{
    getDownloadLink?: {
      ok?: boolean;
      output?: {
        link?: string;
      } | null;
    } | null;
  }>(
    `
      mutation GetDownloadLink($id: ID!, $modelId: ID!, $fileType: DownloadFileTypeEnum!, $source: DownloadSourceEnum!) {
        getDownloadLink(id: $id, printId: $modelId, fileType: $fileType, source: $source) {
          ok
          output {
            link
          }
        }
      }
    `,
    {
      id,
      modelId,
      fileType,
      source: "model_detail",
    },
  );

  const link = data?.getDownloadLink?.output?.link;
  return typeof link === "string" && link ? link : undefined;
}

async function fetchPrintablesGraphQlImportData(
  finalUrl: string,
  html: string,
): Promise<PrintablesGraphQlImportData | undefined> {
  const modelId = getPrintablesModelId(finalUrl, html);
  if (!modelId) {
    return undefined;
  }
  const printablesModelId = modelId;

  const data = await printablesGraphQl<{
    model?: {
      category?: unknown;
      license?: JsonObject | string | null;
      gcodes?: PrintablesGraphQlFile[];
      otherFiles?: PrintablesGraphQlFile[];
      slas?: PrintablesGraphQlFile[];
      stls?: PrintablesGraphQlFile[];
      downloadPacks?: Array<PrintablesGraphQlFile & { fileType?: string }>;
    } | null;
  }>(
    `
      query MakershelfModelImport($id: ID!) {
        model: print(id: $id) {
          category {
            id
            name
            nameEn
            path {
              id
              name
              nameEn
            }
          }
          license {
            id
            name
            disallowRemixing
          }
          gcodes {
            id
            name
            folder
          }
          stls {
            id
            name
            folder
          }
          slas {
            id
            name
            folder
          }
          otherFiles {
            id
            name
            folder
          }
          downloadPacks {
            id
            name
            fileType
          }
        }
      }
    `,
    { id: modelId },
  );

  const model = data?.model;
  if (!model) {
    return undefined;
  }

  const DOWNLOAD_CONCURRENCY = 5;
  type DownloadItem = { file: PrintablesGraphQlFile; fileType: "gcode" | "other" | "pack" | "sla" | "stl" };

  async function batchGetDownloadLinks(items: DownloadItem[]) {
    const results: Array<{ file: PrintablesGraphQlFile; link: string | undefined }> = [];
    for (let i = 0; i < items.length; i += DOWNLOAD_CONCURRENCY) {
      const batch = items.slice(i, i + DOWNLOAD_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async ({ file, fileType }) => {
          const fileId = file.id;
          return {
            file,
            link: fileId ? await getPrintablesDownloadLink(printablesModelId, fileId, fileType) : undefined,
          };
        }),
      );
      results.push(...batchResults);
    }
    return results;
  }

  const allItems: DownloadItem[] = [];
  for (const [key, fileType] of Object.entries(printablesDownloadTypeByKey)) {
    const files = model[key as keyof typeof model] as PrintablesGraphQlFile[] | undefined;
    for (const file of files ?? []) {
      if (file.id) allItems.push({ file, fileType });
    }
  }

  const fileLinks = new Set<string>();
  const downloadResults = await batchGetDownloadLinks(allItems);
  for (const { file, link } of downloadResults) {
    if (link) fileLinks.add(withDownloadFilename(link, file));
  }

  if (fileLinks.size === 0) {
    const packItems: DownloadItem[] = (model.downloadPacks ?? [])
      .filter((pack) => pack.id)
      .map((pack) => ({ file: pack, fileType: "pack" as const }));
    const packResults = await batchGetDownloadLinks(packItems);
    for (const { file, link } of packResults) {
      if (link) fileLinks.add(withDownloadFilename(link, file));
    }
  }

  const license =
    typeof model.license === "string"
      ? normalizeLicense(model.license)
      : normalizeLicense(readNameLike(model.license)) ||
        normalizeLicense(String((model.license as JsonObject | undefined)?.id ?? ""));

  return {
    category: readNameLike(model.category),
    license,
    fileLinks: Array.from(fileLinks),
  };
}

function extractMetaValues(html: string, property: string) {
  const pattern = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${pattern}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "gi",
  );

  return Array.from(html.matchAll(regex)).map((match) => decodeHtml(match[1]?.trim() ?? ""));
}

function extractTitle(html: string) {
  return decodeHtml(html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? "");
}

function extractJsonLdObjects(html: string) {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const results: JsonObject[] = [];

  for (const match of html.matchAll(regex)) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          if (entry && typeof entry === "object") results.push(entry as JsonObject);
        });
      } else if (parsed && typeof parsed === "object") {
        results.push(parsed as JsonObject);
      }
    } catch {
      continue;
    }
  }

  return results;
}

function extractFetchedJsonBodies(html: string) {
  const regex =
    /<script type="application\/json" data-sveltekit-fetched[^>]*data-url="([^"]+)"[^>]*>([\s\S]*?)<\/script>/gi;
  const results: Array<{ url: string; body: JsonObject }> = [];

  for (const match of html.matchAll(regex)) {
    const url = match[1]?.trim();
    const raw = match[2]?.trim();
    if (!url || !raw) continue;

    try {
      const parsed = JSON.parse(raw) as { body?: string };
      if (!parsed.body) continue;
      results.push({
        url,
        body: JSON.parse(parsed.body) as JsonObject,
      });
    } catch {
      continue;
    }
  }

  return results;
}

function extractPrintablesModelData(html: string) {
  const fetchedJson = extractFetchedJsonBodies(html);
  for (const entry of fetchedJson) {
    if (!entry.url.includes("api.printables.com/graphql")) {
      continue;
    }

    const model = (entry.body.data as JsonObject | undefined)?.model as JsonObject | undefined;
    if (model) {
      return model;
    }
  }
}

function flattenJsonLd(objects: JsonObject[]) {
  const flattened: JsonObject[] = [];

  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      const object = value as JsonObject;
      flattened.push(object);
      if (object["@graph"]) visit(object["@graph"]);
      if (object.mainEntity) visit(object.mainEntity);
      if (object.author) visit(object.author);
      if (object.creator) visit(object.creator);
      if (object.publisher) visit(object.publisher);
    }
  };

  objects.forEach(visit);
  return flattened;
}

function readJsonLdString(objects: JsonObject[], key: string) {
  for (const object of objects) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) {
      return decodeHtml(value.trim());
    }
    if (Array.isArray(value)) {
      const first = value.find((entry) => typeof entry === "string" && entry.trim());
      if (typeof first === "string") {
        return decodeHtml(first.trim());
      }
    }
  }
}

function readJsonLdPersonName(objects: JsonObject[], key: string) {
  for (const object of objects) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) {
      return decodeHtml(value.trim());
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) {
          return decodeHtml(entry.trim());
        }
        if (entry && typeof entry === "object" && typeof (entry as JsonObject).name === "string") {
          return decodeHtml(String((entry as JsonObject).name).trim());
        }
      }
    }
    if (value && typeof value === "object" && typeof (value as JsonObject).name === "string") {
      return decodeHtml(String((value as JsonObject).name).trim());
    }
  }
}

function readNameLike(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return decodeHtml(value.trim());
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = readNameLike(entry);
      if (nested) return nested;
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const object = value as JsonObject;
    return (
      readNameLike(object.name) ||
      readNameLike(object.nameEn) ||
      readNameLike(object.title) ||
      readNameLike(object.label) ||
      readNameLike(object.slug) ||
      readNameLike(object.path)
    );
  }
}

function extractPrintablesTags(html: string) {
  const model = extractPrintablesModelData(html);
  if (!model) return [];

  const raw = model.tags;
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          const obj = entry as JsonObject;
          return (
            readNameLike(obj.name) || readNameLike(obj.slug) || readNameLike(obj.label) || ""
          );
        }
        return "";
      })
      .filter(Boolean);
  }

  return [];
}

function extractKeywords(html: string, jsonLd: JsonObject[], finalUrl?: string) {
  const tags = [
    ...extractMetaValues(html, "keywords")
      .flatMap((entry) => entry.split(","))
      .map((tag) => tag.trim()),
  ];

  const jsonLdKeywords = readJsonLdString(jsonLd, "keywords");
  if (jsonLdKeywords) {
    tags.push(
      ...jsonLdKeywords
        .split(",")
        .map((tag) => tag.trim()),
    );
  }

  if (finalUrl && detectSourcePlatform(finalUrl) === "Printables") {
    tags.push(...extractPrintablesTags(html));
  }

  return Array.from(new Set(tags.filter(Boolean)));
}

function extractPrintablesCategory(html: string) {
  const model = extractPrintablesModelData(html);
  if (!model) {
    return undefined;
  }

  return (
    readNameLike(model.category) ||
    readNameLike(model.categoryPath) ||
    readNameLike(model.mainCategory) ||
    readNameLike(model.categories) ||
    readNameLike(model.categoryName)
  );
}

function extractCategory(html: string, jsonLd: JsonObject[], finalUrl: string) {
  if (detectSourcePlatform(finalUrl) === "Printables") {
    const printablesCategory = extractPrintablesCategory(html);
    if (printablesCategory) {
      return printablesCategory;
    }
  }

  return (
    extractMetaValues(html, "article:section")[0] ||
    extractMetaValues(html, "category")[0] ||
    readJsonLdString(jsonLd, "category") ||
    readJsonLdString(jsonLd, "genre") ||
    readNameLike(jsonLd.map((object) => object.about))
  );
}

function normalizeLicense(raw?: string) {
  if (!raw) return undefined;
  const value = raw.trim();
  const normalized = value.toLowerCase();

  const direct = licenseOptions.find((option) => option.value.toLowerCase() === normalized);
  if (direct) return direct.value;

  const aliases: Array<[string, string]> = [
    ["public domain", "CC0 1.0"],
    ["creativecommons.org/publicdomain/zero/1.0", "CC0 1.0"],
    ["creativecommons.org/licenses/by/4.0", "CC BY 4.0"],
    ["creativecommons.org/licenses/by-sa/4.0", "CC BY-SA 4.0"],
    ["creativecommons.org/licenses/by-nd/4.0", "CC BY-ND 4.0"],
    ["creativecommons.org/licenses/by-nc-sa/4.0", "CC BY-NC-SA 4.0"],
    ["creativecommons.org/licenses/by-nc-nd/4.0", "CC BY-NC-ND 4.0"],
    ["creativecommons.org/licenses/by-nc/4.0", "CC BY-NC 4.0"],
    ["creativecommons.org/licenses/by-nc-", "CC BY-NC 4.0"],
    ["cc0", "CC0 1.0"],
    ["attribution — noncommercial — no derivates", "CC BY-NC-ND 4.0"],
    ["attribution - noncommercial - no derivates", "CC BY-NC-ND 4.0"],
    ["attribution — noncommercial — no derivatives", "CC BY-NC-ND 4.0"],
    ["attribution - noncommercial - no derivatives", "CC BY-NC-ND 4.0"],
    ["cc by-nc-nd", "CC BY-NC-ND 4.0"],
    ["cc by nc nd", "CC BY-NC-ND 4.0"],
    ["attribution — noncommercial — share alike", "CC BY-NC-SA 4.0"],
    ["attribution - noncommercial - share alike", "CC BY-NC-SA 4.0"],
    ["cc by-nc-sa", "CC BY-NC-SA 4.0"],
    ["cc by nc sa", "CC BY-NC-SA 4.0"],
    ["attribution — noncommercial", "CC BY-NC 4.0"],
    ["attribution - noncommercial", "CC BY-NC 4.0"],
    ["cc by-nc", "CC BY-NC 4.0"],
    ["cc by nc", "CC BY-NC 4.0"],
    ["attribution — no derivates", "CC BY-ND 4.0"],
    ["attribution - no derivates", "CC BY-ND 4.0"],
    ["attribution — no derivatives", "CC BY-ND 4.0"],
    ["attribution - no derivatives", "CC BY-ND 4.0"],
    ["cc by-nd", "CC BY-ND 4.0"],
    ["cc by nd", "CC BY-ND 4.0"],
    ["attribution — share alike", "CC BY-SA 4.0"],
    ["attribution - share alike", "CC BY-SA 4.0"],
    ["attribution - sharealike", "CC BY-SA 4.0"],
    ["attribution — sharealike", "CC BY-SA 4.0"],
    ["cc by-sa", "CC BY-SA 4.0"],
    ["cc by sa", "CC BY-SA 4.0"],
    ["attribution", "CC BY 4.0"],
    ["cc by", "CC BY 4.0"],
    ["non commercial", "Non-Commercial"],
    ["personal use", "Personal Use"],
    ["all rights reserved", "All Rights Reserved"],
    ["commercial license", "Commercial License"],
    ["standard digital file license", "Standard Digital File License"],
    ["printables digital file license", "Standard Digital File License"],
    ["mit license", "MIT"],
    ["apache license 2.0", "Apache-2.0"],
    ["gpl-3.0", "GPL-3.0"],
    ["cern-ohl-s-2.0", "CERN-OHL-S-2.0"],
    ["cern-ohl-w-2.0", "CERN-OHL-W-2.0"],
    ["cern-ohl-p-2.0", "CERN-OHL-P-2.0"],
  ];

  for (const [needle, license] of aliases) {
    if (normalized.includes(needle)) {
      return license;
    }
  }

  return value;
}

function extractLicense(html: string, jsonLd: JsonObject[]) {
  const licenseHrefMatches = Array.from(
    html.matchAll(/https?:\/\/creativecommons\.org\/licenses\/[^"'\\s<)]+/gi),
  ).map((match) => match[0]);

  const bodyPatterns = [
    /Creative Commons[\s\S]{0,300}?Public Domain/i,
    /Attribution\s+[—-]\s+Noncommercial\s+[—-]\s+No Derivat(?:es|ives)/i,
    /Attribution\s+[—-]\s+Noncommercial\s+[—-]\s+Share Alike/i,
    /Attribution\s+[—-]\s+Noncommercial/i,
    /Attribution\s+[—-]\s+No Derivat(?:es|ives)/i,
    /Attribution\s+[—-]\s+Share Alike/i,
    /Personal Use/i,
    /All Rights Reserved/i,
  ]
    .map((pattern) => html.match(pattern)?.[0])
    .filter(Boolean) as string[];

  const candidates = [
    ...licenseHrefMatches,
    ...extractMetaValues(html, "license"),
    ...extractMetaValues(html, "og:license"),
    readJsonLdString(jsonLd, "license"),
    html.match(/"license"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/Creative Commons[^<"\n]+/i)?.[0],
    ...bodyPatterns,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const normalized = normalizeLicense(candidate);
    if (normalized) {
      return normalized;
    }
  }
}

function extractAuthor(html: string, jsonLd: JsonObject[], sourceUrl: string) {
  const platform = detectSourcePlatform(sourceUrl);
  const printablesModel = platform === "Printables" ? extractPrintablesModelData(html) : undefined;
  const printablesAuthor = printablesModel
    ? (((printablesModel.user as JsonObject | undefined)?.publicUsername as string | undefined) ??
      ((printablesModel.user as JsonObject | undefined)?.handle as string | undefined))
    : undefined;
  const metaAuthor =
    printablesAuthor ||
    extractMetaValues(html, "author")[0] ||
    extractMetaValues(html, "article:author")[0] ||
    readJsonLdPersonName(jsonLd, "author") ||
    readJsonLdPersonName(jsonLd, "creator");

  const patterns =
    platform === "Thingiverse"
      ? [
          /"creator"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
          /"designer"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
          /by\s+<[^>]*>\s*([^<]+)\s*<\/a>/i,
        ]
      : platform === "Cults3D"
        ? [
            /"creator_username"\s*:\s*"([^"]+)"/i,
            /"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
          ]
        : [
            /"author"\s*:\s*"([^"]+)"/i,
            /"creator"\s*:\s*"([^"]+)"/i,
            /"name"\s*:\s*"([^"]+)"\s*,\s*"@type"\s*:\s*"Person"/i,
          ];

  if (metaAuthor && metaAuthor !== platform) {
    return metaAuthor;
  }

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1]?.trim();
    if (match && match !== platform) {
      return decodeHtml(match);
    }
  }

  return metaAuthor || undefined;
}

function extractPrintablesLicense(html: string) {
  const model = extractPrintablesModelData(html);
  const license = model?.license as JsonObject | string | undefined;

  if (license && typeof license === "object") {
    const candidates = [
      license.name,
      license.title,
      license.label,
      license.shortName,
      license.slug,
      license.url,
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const normalized = normalizeLicense(candidate);
      if (normalized) {
        return normalized;
      }
    }

    const id = license.id;
    const licenseId =
      typeof id === "string" || typeof id === "number" ? String(id).trim() : "";
    if (licenseId && printablesLicenseIdMap[licenseId]) {
      return printablesLicenseIdMap[licenseId];
    }
  }

  return typeof license === "string" ? normalizeLicense(license) : undefined;
}

function extractImages(html: string, jsonLd: JsonObject[], finalUrl: string) {
  const values = [
    ...extractMetaValues(html, "og:image"),
    ...extractMetaValues(html, "twitter:image"),
    readJsonLdString(jsonLd, "image"),
  ].filter(Boolean) as string[];

  return Array.from(
    new Set(
      values
        .flatMap((entry) => entry.split(","))
        .map((entry) => absoluteUrl(entry.trim(), finalUrl))
        .filter(Boolean) as string[],
    ),
  );
}

function extractDownloadLinks(html: string, finalUrl: string) {
  const regex = new RegExp(
    String.raw`https?:\/\/[^"'\\s>]+?\.${remoteProjectFileExtensionPattern}(?:\?[^"'\\s>]*)?`,
    "gi",
  );
  const links = Array.from(html.matchAll(regex)).map((match) => match[0]);
  return Array.from(new Set(links.map((link) => absoluteUrl(link, finalUrl)).filter(Boolean) as string[]));
}

function isSupportedRemoteFileCandidate(value: string) {
  return supportedRemoteFileRegex.test(value.trim());
}

function looksLikeDownloadUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isSupportedRemoteFileCandidate(trimmed)) return true;
  return /\/download(?:\?|\/|$)/i.test(trimmed) || /\/files?\//i.test(trimmed);
}

function readStringProperty(object: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
}

function addPrintablesFileCandidate(
  links: Set<string>,
  candidate: string | undefined,
  finalUrl: string,
) {
  if (!candidate || !looksLikeDownloadUrl(candidate)) {
    return;
  }

  const absolute = absoluteUrl(candidate, finalUrl);
  if (absolute) {
    links.add(absolute);
  }
}

function extractPrintablesFileLinks(html: string, finalUrl: string) {
  const model = extractPrintablesModelData(html);
  if (!model) return [];

  const links = new Set<string>();
  const visited = new WeakSet<object>();

  const visit = (value: unknown) => {
    if (!value) return;

    if (typeof value === "string") {
      addPrintablesFileCandidate(links, value, finalUrl);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    const object = value as JsonObject;
    const name = readStringProperty(object, ["name", "fileName", "filename", "displayName"]);
    const directUrl = readStringProperty(object, [
      "url",
      "downloadUrl",
      "download_url",
      "fileUrl",
      "file_url",
      "path",
      "filePath",
    ]);
    addPrintablesFileCandidate(links, directUrl, finalUrl);

    const id = object.id;
    const modelId = model.id;
    if (
      name &&
      isSupportedRemoteFileCandidate(name) &&
      (typeof id === "string" || typeof id === "number") &&
      (typeof modelId === "string" || typeof modelId === "number")
    ) {
      addPrintablesFileCandidate(
        links,
        `https://www.printables.com/model/${modelId}/download/file/${id}#filename=${encodeURIComponent(name)}`,
        finalUrl,
      );
    }

    Object.values(object).forEach(visit);
  };

  visit(model.files);
  visit(model.printFiles);
  visit(model);

  return Array.from(links);
}

function extractThingiverseFileLinks(finalUrl: string) {
  const thingId = finalUrl.match(/\/thing:(\d+)/i)?.[1];
  if (!thingId) {
    return [];
  }

  return [`https://www.thingiverse.com/thing:${thingId}/zip#filename=thingiverse-${thingId}.zip`];
}

async function fetchHtml(
  url: string,
  redirectCount = 0,
): Promise<{ html: string; finalUrl: string; status: number }> {
  if (redirectCount > 5) {
    throw new Error("Zu viele Weiterleitungen beim Import.");
  }

  const parsedUrl = new URL(url);
  if (isPrivateHostname(parsedUrl.hostname)) {
    throw new Error("Zugriff auf interne Adressen ist nicht erlaubt.");
  }
  const requester = parsedUrl.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = requester(
      parsedUrl,
      {
        method: "GET",
        maxHeaderSize: 1024 * 256,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Makershelf/1.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Referer: parsedUrl.origin,
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          const nextUrl = new URL(location, url).toString();
          response.resume();
          fetchHtml(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          const platform = detectSourcePlatform(url);
          if (status === 403 && (platform === "MakerWorld" || platform === "Thangs")) {
            reject(
              new Error(
                `${platform} blockiert den automatischen Import aktuell per Bot-Schutz (HTTP 403). Datei- und Metadatenübernahme ist dort ohne offizielle API oder eingeloggten Browser-Flow nicht stabil möglich.`,
              ),
            );
            return;
          }

          reject(new Error(`Website antwortete mit Status ${status}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            html: Buffer.concat(chunks).toString("utf8"),
            finalUrl: url,
            status,
          });
        });
      },
    );

    request.on("error", (error) => {
      if (error.message.toLowerCase().includes("header overflow")) {
        reject(
          new Error(
            "Abruf fehlgeschlagen: Die Website sendet extrem große Header. Bitte nutze nach Möglichkeit den direkten Projektlink statt einer Share- oder Weiterleitungs-URL.",
          ),
        );
        return;
      }

      reject(new Error(`Abruf fehlgeschlagen: ${error.message}`));
    });

    request.setTimeout(15000, () => {
      request.destroy(new Error("Zeitüberschreitung beim Abruf der Website."));
    });

    request.end();
  });
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const { html, finalUrl } = await fetchHtml(url);
    const jsonLd = flattenJsonLd(extractJsonLdObjects(html));
    const sourcePlatform = detectSourcePlatform(finalUrl);
    const printablesImportData =
      sourcePlatform === "Printables"
        ? await fetchPrintablesGraphQlImportData(finalUrl, html)
        : undefined;
    const title =
      extractMetaValues(html, "og:title")[0] ||
      readJsonLdString(jsonLd, "name") ||
      extractTitle(html);
    const description =
      extractMetaValues(html, "og:description")[0] ||
      extractMetaValues(html, "description")[0] ||
      readJsonLdString(jsonLd, "description");
    const author = extractAuthor(html, jsonLd, finalUrl);
    const category = printablesImportData?.category || extractCategory(html, jsonLd, finalUrl);
    const tags = extractKeywords(html, jsonLd, finalUrl);
    const images = extractImages(html, jsonLd, finalUrl);
    const license =
      sourcePlatform === "Printables"
        ? printablesImportData?.license || extractPrintablesLicense(html) || extractLicense(html, jsonLd)
        : extractLicense(html, jsonLd);
    const fileLinks = Array.from(
      new Set([
        ...(printablesImportData?.fileLinks ?? []),
        ...extractDownloadLinks(html, finalUrl),
        ...(sourcePlatform === "Printables" ? extractPrintablesFileLinks(html, finalUrl) : []),
        ...(sourcePlatform === "Thingiverse" ? extractThingiverseFileLinks(finalUrl) : []),
      ]),
    );

    if (!title && !description && !author && !license && tags.length === 0 && images.length === 0) {
      return NextResponse.json(
        {
          error:
            "Es konnten keine verwertbaren Metadaten erkannt werden. Die Seite blockiert den Import oder liefert ihre Daten nur clientseitig per Skript.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      sourceUrl: finalUrl,
      sourcePlatform,
      title,
      description,
      author,
      category,
      license,
      tags,
      images,
      fileLinks,
      warnings:
        fileLinks.length === 0
          ? [
              `${sourcePlatform || "Diese Quelle"} stellt aktuell keine stabilen öffentlichen Datei-Links bereit. Metadaten wurden übernommen, Dateien müssen manuell oder per ZIP ergänzt werden.`,
            ]
          : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 },
    );
  }
}
