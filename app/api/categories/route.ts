import { NextResponse } from "next/server";
import { z } from "zod";

import { slugify } from "@/src/lib/makershelf-data";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const categorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500),
  emoji: z.string().min(1).max(10),
  color: z.string().min(4).max(32),
});

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canManageSettings) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = categorySchema.parse(await request.json());
  const category = await prisma.category.create({
    data: {
      workspaceId: access.membership.workspaceId,
      slug: slugify(body.name),
      name: body.name,
      description: body.description,
      emoji: body.emoji,
      color: body.color,
    },
  });

  return NextResponse.json({
    id: category.id,
    name: category.name,
    description: category.description,
    emoji: category.emoji,
    color: category.color,
  });
}
