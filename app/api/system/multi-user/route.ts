import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const schema = z.object({ multiUserEnabled: z.boolean() });

export async function PATCH(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = schema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: access.membership.workspaceId },
    select: { settingsJson: true },
  });

  const current = (workspace?.settingsJson as Record<string, unknown>) ?? {};
  const updated = { ...current, multiUserEnabled: body.data.multiUserEnabled };

  await prisma.workspace.update({
    where: { id: access.membership.workspaceId },
    data: { settingsJson: updated },
  });

  return NextResponse.json({ ok: true, multiUserEnabled: body.data.multiUserEnabled });
}
