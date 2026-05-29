import { NextResponse } from "next/server";
import { Prisma, ProjectStatus } from "@prisma/client";
import { z } from "zod";

import { slugify } from "@/src/lib/makershelf-data";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const linkSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  url: z.string().min(1),
});

const optionalTextSchema = z.preprocess(
  (value) => (value === null || value === undefined ? "" : value),
  z.string(),
);

const projectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: optionalTextSchema.default(""),
  categoryId: optionalTextSchema.default(""),
  license: z.string().min(1).max(120),
  tags: z.array(z.string()).default([]).transform((tags) => tags.filter((tag) => tag.trim())),
  author: optionalTextSchema.default("Unknown"),
  sourceUrl: optionalTextSchema.default(""),
  coverImage: optionalTextSchema.default(""),
  creatorId: optionalTextSchema.default(""),
  creatorFolderId: optionalTextSchema.default(""),
  activity: z
    .object({
      isActive: z.boolean().default(false),
      printedFileIds: z.array(z.string()).default([]),
      steps: z.array(z.string()).default([]),
      shoppingList: z.array(z.string()).default([]),
      links: z.array(linkSchema).default([]),
    })
    .default({
      isActive: false,
      printedFileIds: [],
      steps: [],
      shoppingList: [],
      links: [],
    }),
});

export async function POST(request: Request) {
  try {
    const access = await requireWorkspaceAccess();
    if (!access.ok) {
      return access.response;
    }

    if (access.permissions.isReadOnly || !access.permissions.canEditProjects) {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const body = projectSchema.parse(await request.json());
    const workspaceId = access.membership.workspaceId;
    const [category, creator, creatorFolder] = await Promise.all([
      body.categoryId
        ? prisma.category.findFirst({ where: { id: body.categoryId, workspaceId } })
        : null,
      body.creatorId
        ? prisma.creator.findFirst({ where: { id: body.creatorId, workspaceId } })
        : null,
      body.creatorFolderId
        ? prisma.creatorFolder.findFirst({
            where: {
              id: body.creatorFolderId,
              creator: { workspaceId },
            },
          })
        : null,
    ]);

    const creatorId = creator?.id ?? null;
    const creatorFolderId =
      creatorFolder && (!creatorId || creatorFolder.creatorId === creatorId)
        ? creatorFolder.id
        : null;

    const project = await prisma.project.create({
      data: {
        workspaceId,
        title: body.title,
        slug: slugify(body.title),
        description: body.description,
        author: body.author,
        license: body.license,
        sourceUrl: body.sourceUrl || null,
        sourcePlatform: body.sourceUrl || null,
        coverImage: body.coverImage || null,
        coverLabel: body.title.slice(0, 8).toUpperCase(),
        coverGradient: "",
        categoryId: category?.id ?? null,
        creatorId,
        creatorFolderId,
        favorite: false,
        metadataJson: {
          createdByName: access.session.user.name,
          createdByUserId: access.session.user.id,
          ignoredCategoryId: body.categoryId && !category ? body.categoryId : undefined,
          ignoredCreatorId: body.creatorId && !creator ? body.creatorId : undefined,
          ignoredCreatorFolderId: body.creatorFolderId && !creatorFolder ? body.creatorFolderId : undefined,
        },
        status: body.activity.isActive ? ProjectStatus.ACTIVE : ProjectStatus.PLANNED,
        tags: body.tags,
        lockedFields: [],
        steps: {
          create: body.activity.steps.map((step, index) => ({
            label: step,
            sortOrder: index,
          })),
        },
        shoppingItems: {
          create: body.activity.shoppingList.map((item, index) => ({
            label: item,
            sortOrder: index,
          })),
        },
        links: {
          create: body.activity.links.map((link, index) => ({
            label: link.label,
            url: link.url,
            sortOrder: index,
          })),
        },
      },
    });

    return NextResponse.json({ id: project.id, createdByName: access.session.user.name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Projektangaben sind unvollständig oder ungültig.", issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Ein Projekt mit diesem Namen existiert bereits." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Projekt konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
