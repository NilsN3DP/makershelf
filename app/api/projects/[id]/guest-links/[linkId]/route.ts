import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; linkId: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id, linkId } = await context.params;
  const link = await prisma.projectGuestLink.findFirst({
    where: {
      id: linkId,
      projectId: id,
      project: {
        workspaceId: access.membership.workspaceId,
      },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Gastlink nicht gefunden." }, { status: 404 });
  }

  await prisma.projectGuestLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
