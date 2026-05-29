import { NextResponse } from "next/server";
import { ProjectStatus } from "@prisma/client";
import { z } from "zod";

import { slugify } from "@/src/lib/makershelf-data";
import { deleteStoredFileFromDisk } from "@/src/lib/server/file-storage";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
});

const projectSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().default(""),
  categoryId: z.string().optional().default(""),
  license: z.string().min(1).max(120),
  tags: z.array(z.string()).default([]),
  author: z.string().default("Unknown"),
  sourceUrl: z.string().optional().default(""),
  coverImage: z.string().optional().default(""),
  creatorId: z.string().optional().default(""),
  creatorFolderId: z.string().optional().default(""),
  favorite: z.boolean().optional(),
  activity: z.object({
    isActive: z.boolean().default(false),
    printedFileIds: z.array(z.string()).default([]),
    steps: z.array(z.string()).default([]),
    shoppingList: z.array(z.string()).default([]),
    links: z.array(linkSchema).default([]),
  }).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = projectSchema.parse(await request.json());

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        title: body.title,
        slug: slugify(body.title),
        description: body.description,
        author: body.author,
        license: body.license,
        sourceUrl: body.sourceUrl || null,
        sourcePlatform: body.sourceUrl || null,
        coverImage: body.coverImage || null,
        coverLabel: body.title.slice(0, 8).toUpperCase(),
        categoryId: body.categoryId || null,
        creatorId: body.creatorId || null,
        creatorFolderId: body.creatorFolderId || null,
        favorite: body.favorite,
        status:
          body.activity?.isActive === true ? ProjectStatus.ACTIVE : ProjectStatus.PLANNED,
        tags: body.tags,
      },
    });

    if (body.activity) {
      await tx.projectStep.deleteMany({ where: { projectId: id } });
      await tx.shoppingItem.deleteMany({ where: { projectId: id } });
      await tx.projectLink.deleteMany({ where: { projectId: id } });

      if (body.activity.steps.length > 0) {
        await tx.projectStep.createMany({
          data: body.activity.steps.map((step, index) => ({
            projectId: id,
            label: step,
            sortOrder: index,
          })),
        });
      }

      if (body.activity.shoppingList.length > 0) {
        await tx.shoppingItem.createMany({
          data: body.activity.shoppingList.map((item, index) => ({
            projectId: id,
            label: item,
            sortOrder: index,
          })),
        });
      }

      if (body.activity.links.length > 0) {
        await tx.projectLink.createMany({
          data: body.activity.links.map((link, index) => ({
            projectId: id,
            label: link.label,
            url: link.url,
            sortOrder: index,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
    },
    include: {
      files: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  await Promise.all(
    project.files.map((file) =>
      deleteStoredFileFromDisk({
        storedPath: file.storedPath,
        preferRuntimeRoot: true,
      }),
    ),
  );

  await prisma.project.deleteMany({
    where: {
      id,
      workspaceId: access.membership.workspaceId,
    },
  });

  return NextResponse.json({ ok: true });
}
