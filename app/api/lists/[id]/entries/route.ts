import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const entrySchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = entrySchema.parse(await request.json());

  const [list, project] = await Promise.all([
    prisma.projectList.findFirst({
      where: { id, workspaceId: access.membership.workspaceId },
      select: { id: true },
    }),
    prisma.project.findFirst({
      where: { id: body.projectId, workspaceId: access.membership.workspaceId },
      select: { id: true },
    }),
  ]);

  if (!list) return NextResponse.json({ error: "Liste nicht gefunden." }, { status: 404 });
  if (!project) return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });

  await prisma.projectListEntry.upsert({
    where: { listId_projectId: { listId: id, projectId: body.projectId } },
    update: {},
    create: { listId: id, projectId: body.projectId },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId fehlt." }, { status: 400 });
  }

  const [list, project] = await Promise.all([
    prisma.projectList.findFirst({
      where: { id, workspaceId: access.membership.workspaceId },
      select: { id: true },
    }),
    prisma.project.findFirst({
      where: { id: projectId, workspaceId: access.membership.workspaceId },
      select: { id: true },
    }),
  ]);

  if (!list) return NextResponse.json({ error: "Liste nicht gefunden." }, { status: 404 });
  if (!project) return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });

  await prisma.projectListEntry.deleteMany({
    where: { listId: id, projectId },
  });

  return NextResponse.json({ ok: true });
}
