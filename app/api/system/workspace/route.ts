import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const patchSchema = z.object({
  name: z.string().min(1).max(120).trim(),
});

export async function PATCH(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = patchSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Ungültiger Name." }, { status: 400 });
  }

  await prisma.workspace.update({
    where: { id: access.membership.workspaceId },
    data: { name: body.data.name },
  });

  return NextResponse.json({ ok: true, name: body.data.name });
}
