import { NextResponse } from "next/server";
import { z } from "zod";

import { slugify } from "@/src/lib/makershelf-data";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const listSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = listSchema.parse(await request.json());
  const list = await prisma.projectList.create({
    data: {
      workspaceId: access.membership.workspaceId,
      slug: slugify(body.name),
      name: body.name,
      isSystem: false,
    },
  });

  return NextResponse.json({
    id: list.id,
    name: list.name,
    projectIds: [],
  });
}
