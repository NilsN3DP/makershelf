import { NextResponse } from "next/server";
import { z } from "zod";

import { slugify } from "@/src/lib/makershelf-data";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const creatorSchema = z.object({
  name: z.string().min(1).max(120),
  folders: z.array(z.string().trim().min(1).max(120)).default([]),
});

export async function PATCH(
  request: Request,
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
  const body = creatorSchema.parse(await request.json());

  const updated = await prisma.$transaction(async (tx) => {
    const creator = await tx.creator.update({
      where: { id },
      data: {
        name: body.name,
        slug: slugify(body.name),
      },
    });

    await tx.creatorFolder.deleteMany({
      where: { creatorId: id },
    });

    if (body.folders.length > 0) {
      await tx.creatorFolder.createMany({
        data: body.folders.map((folder) => ({
          creatorId: id,
          slug: slugify(folder),
          name: folder,
        })),
      });
    }

    return tx.creator.findUniqueOrThrow({
      where: { id: creator.id },
      include: { folders: true },
    });
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    folders: updated.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
  });
}

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
  await prisma.creator.deleteMany({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
    },
  });

  return NextResponse.json({ ok: true });
}
