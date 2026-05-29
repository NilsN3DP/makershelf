import { NextResponse } from "next/server";
import { z } from "zod";

import { buildProjectInfoJson, buildProjectStorageBasePath, MAKERSHELFINFO_FILE_NAME } from "@/src/lib/project-info";
import type { AppSettings, Category, Creator, Project } from "@/src/lib/makershelf-data";
import { writeStoredFile } from "@/src/lib/server/file-storage";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  emoji: z.string().default(""),
  color: z.string().default(""),
});

const creatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  folders: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
});

const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  originalName: z.string(),
  type: z.string(),
  sizeBytes: z.number(),
  sizeLabel: z.string(),
  mimeType: z.string().optional(),
  originalPath: z.string().optional(),
  folderPath: z.string().optional(),
  storedPath: z.string(),
  notes: z.string().default(""),
  source: z.enum(["upload", "zip", "website", "indexing"]),
  uploadedAt: z.string(),
  extractedFromZip: z.string().optional(),
});

const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  coverLabel: z.string().default(""),
  coverGradient: z.string().default(""),
  tags: z.array(z.string()).default([]),
  categoryId: z.string().default(""),
  creatorId: z.string().optional(),
  creatorFolderId: z.string().optional(),
  license: z.string().default("Unknown"),
  author: z.string().default("Unknown"),
  sourceUrl: z.string().optional(),
  coverImage: z.string().optional(),
  sourcePlatform: z.string().optional(),
  thumbnailFileId: z.string().optional(),
  lockedFields: z.array(z.string()).default([]),
  favorite: z.boolean().default(false),
  createdByName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  files: z.array(fileSchema).default([]),
  activity: z
    .object({
      isActive: z.boolean().default(false),
      printedFileIds: z.array(z.string()).default([]),
      steps: z.array(z.string()).default([]),
      shoppingList: z.array(z.string()).default([]),
      links: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            url: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),
});

const requestSchema = z.object({
  settings: z.object({
    appName: z.string().default("makershelf"),
    storageMode: z.enum(["browser", "project-folders", "custom-path"]),
    storagePath: z.string().default(""),
  }),
  categories: z.array(categorySchema).default([]),
  creators: z.array(creatorSchema).default([]),
  projects: z.array(projectSchema).default([]),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    const access = await requireWorkspaceAccess();
    if (!access.ok) {
      return access.response;
    }

    for (const project of body.projects) {
      const storedPath = `${buildProjectStorageBasePath(project as Project, body.creators as Creator[])}/${MAKERSHELFINFO_FILE_NAME}`;
      const content = buildProjectInfoJson({
        project: project as Project,
        categories: body.categories as Category[],
        creators: body.creators as Creator[],
        settings: body.settings as Pick<
          AppSettings,
          "appName" | "storageMode" | "storagePath"
        >,
      });

      await writeStoredFile(
        {
          storedPath,
          storageMode: body.settings.storageMode,
          storagePath: body.settings.storagePath,
          preferRuntimeRoot: true,
        },
        Buffer.from(content, "utf8"),
      );
    }

    return NextResponse.json({ ok: true, written: body.projects.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "MakershelfInfo-Dateien konnten nicht geschrieben werden.",
      },
      { status: 500 },
    );
  }
}
