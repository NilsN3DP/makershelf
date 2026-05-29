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

  if (access.permissions.isReadOnly || !access.permissions.canManageSettings) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id } = await context.params;
  await prisma.category.deleteMany({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
    },
  });

  return NextResponse.json({ ok: true });
}
