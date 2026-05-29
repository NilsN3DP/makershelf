import { NextResponse } from "next/server";

import {
  buildGuestSubmissionUrl,
  createGuestSubmissionToken,
  sanitizeGuestSubmissionLabel,
} from "@/src/lib/server/guest-submission-links";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

function mapLink(request: Request, link: {
  id: string;
  token: string;
  label: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: link.id,
    label: link.label,
    url: buildGuestSubmissionUrl(request, link.token),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const links = await prisma.guestProjectSubmissionLink.findMany({
    where: { workspaceId: access.membership.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    links: links.map((link) => mapLink(request, link)),
  });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { label?: string; expiresInDays?: number | null };
  const expiresInDays = typeof body.expiresInDays === "number" ? body.expiresInDays : null;
  const expiresAt = expiresInDays && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const link = await prisma.guestProjectSubmissionLink.create({
    data: {
      workspaceId: access.membership.workspaceId,
      token: createGuestSubmissionToken(),
      label: sanitizeGuestSubmissionLabel(body.label),
      expiresAt,
    },
  });

  return NextResponse.json({ link: mapLink(request, link) }, { status: 201 });
}
