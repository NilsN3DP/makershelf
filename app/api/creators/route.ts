import { NextResponse } from "next/server";
import { z } from "zod";

import { slugify } from "@/src/lib/makershelf-data";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const creatorSchema = z.object({
  name: z.string().min(1).max(120),
  folders: z.array(z.string().trim().min(1).max(120)).default([]),
});

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = creatorSchema.parse(await request.json());
  const creator = await prisma.creator.create({
    data: {
      workspaceId: access.membership.workspaceId,
      slug: slugify(body.name),
      name: body.name,
      folders: {
        create: body.folders.map((folder) => ({
          slug: slugify(folder),
          name: folder,
        })),
      },
    },
    include: {
      folders: true,
    },
  });

  return NextResponse.json({
    id: creator.id,
    name: creator.name,
    folders: creator.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
  });
}
