import { NextRequest, NextResponse } from "next/server";

import { verifyDownloadToken } from "@/src/lib/server/download-token";
import { readStoredFile } from "@/src/lib/server/file-storage";
import { prisma } from "@/src/lib/server/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const fileId = verifyDownloadToken(token);
  if (!fileId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = await readStoredFile({ storedPath: file.storedPath, preferRuntimeRoot: true });
  const filename = encodeURIComponent(file.name).replace(/'/g, "%27");

  return new Response(buffer, {
    headers: {
      "Content-Type": file.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.name}"; filename*=UTF-8''${filename}`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
