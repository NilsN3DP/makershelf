import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id } = await context.params;

  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Einladung nicht gefunden." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.workspaceInvite.delete({
      where: { id: invite.id },
    }),
    prisma.auditLog.create({
      data: {
        workspaceId: access.membership.workspaceId,
        userId: access.session.user.id,
        action: "invite.delete",
        entityType: "invite",
        entityId: invite.id,
        message: `Invitation for ${invite.email} revoked.`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
