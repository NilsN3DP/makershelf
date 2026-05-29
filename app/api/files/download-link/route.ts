import { NextRequest, NextResponse } from "next/server";

import { createDownloadToken } from "@/src/lib/server/download-token";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const body = (await request.json()) as { fileId?: string };
  if (!body.fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }

  const token = createDownloadToken(body.fileId);
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "https";
  const url = `${proto}://${host}/api/files/serve?token=${token}`;

  return NextResponse.json({ url });
}
