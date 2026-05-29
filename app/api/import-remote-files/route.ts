import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { isSupportedProjectFile } from "@/src/lib/makershelf-data";
import { isPrivateHostname } from "@/src/lib/server/ssrf-protection";

type ImportBody = {
  urls?: string[];
};

async function fetchFileBuffer(
  url: string,
  redirectCount = 0,
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  if (redirectCount > 5) {
    throw new Error("Zu viele Weiterleitungen beim Dateiimport.");
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
          Accept: "*/*",
          Referer: parsedUrl.origin,
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          const nextUrl = new URL(location, url).toString();
          response.resume();
          fetchFileBuffer(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Datei antwortete mit Status ${status}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: response.headers["content-type"] || "application/octet-stream",
            finalUrl: url,
          });
        });
      },
    );

    request.on("error", (error) => reject(error));
    request.setTimeout(20000, () => {
      request.destroy(new Error("Zeitüberschreitung beim Dateidownload."));
    });
    request.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImportBody;
    const urls = Array.from(new Set((body.urls ?? []).map((entry) => entry.trim()).filter(Boolean)));

    if (urls.length === 0) {
      return NextResponse.json({ files: [], skipped: 0 });
    }

    const imported: Array<{
      name: string;
      mimeType: string;
      data: number[];
      sourceUrl: string;
    }> = [];
    let skipped = 0;

    for (const url of urls) {
      const parsedUrl = new URL(url);
      const hashFileName = parsedUrl.hash.match(/filename=([^&]+)/)?.[1];
      const queryFileName = parsedUrl.searchParams.get("filename");
      const fileName =
        (hashFileName ? decodeURIComponent(hashFileName) : undefined) ||
        queryFileName ||
        path.basename(parsedUrl.pathname) ||
        "download.bin";
      if (!isSupportedProjectFile(fileName)) {
        skipped += 1;
        continue;
      }

      try {
        const file = await fetchFileBuffer(url);
        imported.push({
          name: fileName,
          mimeType: file.contentType,
          data: Array.from(file.buffer),
          sourceUrl: file.finalUrl,
        });
      } catch {
        skipped += 1;
      }
    }

    return NextResponse.json({ files: imported, skipped });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Remote-Dateien konnten nicht importiert werden.",
      },
      { status: 500 },
    );
  }
}
