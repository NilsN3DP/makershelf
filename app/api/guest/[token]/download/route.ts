import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

import { buildGuestZipPath, canGuestAccessFile, getActiveGuestLink, sanitizeDownloadName } from "@/src/lib/server/guest-links";
import { readStoredFile } from "@/src/lib/server/file-storage";

function fileResponseHeaders(filename: string, contentType: string, contentLength: number, disposition: "attachment" | "inline" = "attachment") {
  const safeFilename = sanitizeDownloadName(filename);
  const encoded = encodeURIComponent(safeFilename).replace(/'/g, "%27");
  return {
    "Content-Type": contentType,
    "Content-Disposition": `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encoded}`,
    "Content-Length": String(contentLength),
    "Cache-Control": "no-store",
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const link = await getActiveGuestLink(token);

  if (!link) {
    return NextResponse.json({ error: "Gastlink ist ungültig oder abgelaufen." }, { status: 404 });
  }

  const downloadAll = request.nextUrl.searchParams.get("all") === "1";

  if (downloadAll) {
    const zip = new JSZip();
    const projectFolderName = sanitizeDownloadName(link.project.title);
    const folder = zip.folder(projectFolderName);

    if (!folder) {
      return NextResponse.json({ error: "ZIP konnte nicht erstellt werden." }, { status: 500 });
    }

    folder.file("project-info.txt", [
      `Title: ${link.project.title}`,
      `Description: ${link.project.description || "-"}`,
      `Author: ${link.project.author || "-"}`,
      `License: ${link.project.license || "-"}`,
      `Source: ${link.project.sourceUrl || "-"}`,
      "",
      "Files:",
      ...link.project.files.map((file) => `- ${file.name} | ${file.type} | ${file.sizeBytes.toString()} bytes`),
    ].join("\n"));

    for (const file of link.project.files) {
      const buffer = await readStoredFile({ storedPath: file.storedPath, preferRuntimeRoot: true });
      folder.file(buildGuestZipPath(file), buffer);
    }

    const archive = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(new Uint8Array(archive), {
      headers: fileResponseHeaders(`${projectFolderName}.zip`, "application/zip", archive.length),
    });
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId || !canGuestAccessFile(link.project, fileId)) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  const file = link.project.files.find((item) => item.id === fileId);
  if (!file) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  }

  const buffer = await readStoredFile({ storedPath: file.storedPath, preferRuntimeRoot: true });
  const inline = request.nextUrl.searchParams.get("inline") === "1";
  return new Response(new Uint8Array(buffer), {
    headers: fileResponseHeaders(file.name, file.mimeType ?? "application/octet-stream", buffer.length, inline ? "inline" : "attachment"),
  });
}
