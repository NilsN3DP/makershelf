import { NextRequest, NextResponse } from "next/server";

import {
  createDownloadManifestToken,
  createDownloadToken,
  verifyDownloadManifestToken,
} from "@/src/lib/server/download-token";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

function getRequestBaseUrl(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "https";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const body = (await request.json()) as { fileIds?: unknown };
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (!fileIds.length) {
    return NextResponse.json({ error: "Missing fileIds" }, { status: 400 });
  }

  const token = createDownloadManifestToken(fileIds);
  const manifestUrl = `${getRequestBaseUrl(request)}/api/files/bridge-manifest?token=${token}`;

  return NextResponse.json({ manifestUrl });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const fileIds = verifyDownloadManifestToken(token);
  if (!fileIds) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const files = await prisma.projectFile.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, name: true },
  });
  const filesById = new Map(files.map((file) => [file.id, file]));
  const baseUrl = getRequestBaseUrl(request);

  return NextResponse.json({
    files: fileIds
      .map((id) => filesById.get(id))
      .filter((file): file is { id: string; name: string } => Boolean(file))
      .map((file) => ({
        name: file.name,
        url: `${baseUrl}/api/files/serve?token=${createDownloadToken(file.id)}`,
      })),
  });
}
