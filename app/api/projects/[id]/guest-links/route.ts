import { NextRequest, NextResponse } from "next/server";

import { createGuestToken } from "@/src/lib/server/guest-links";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

function buildGuestUrl(request: NextRequest, token: string) {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/guest/${token}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
    },
    include: {
      guestLinks: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    links: project.guestLinks.map((link) => ({
      id: link.id,
      label: link.label,
      url: buildGuestUrl(request, link.token),
      expiresAt: link.expiresAt?.toISOString() ?? null,
      revokedAt: link.revokedAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { label?: string; expiresInDays?: number | null };
  const project = await prisma.project.findFirst({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  const expiresInDays = typeof body.expiresInDays === "number" ? body.expiresInDays : null;
  const expiresAt = expiresInDays && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const link = await prisma.projectGuestLink.create({
    data: {
      projectId: project.id,
      token: createGuestToken(),
      label: body.label?.trim() || "Gastlink",
      expiresAt,
    },
  });

  return NextResponse.json({
    link: {
      id: link.id,
      label: link.label,
      url: buildGuestUrl(request, link.token),
      expiresAt: link.expiresAt?.toISOString() ?? null,
      revokedAt: link.revokedAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
    },
  }, { status: 201 });
}
