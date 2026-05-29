import { Prisma } from "@prisma/client";

import { humanFileSize, type FileType, type PrintFile, type Project } from "@/src/lib/makershelf-data";
import { prisma } from "@/src/lib/server/prisma";
import {
  buildGuestZipPath,
  canGuestAccessFile,
  createGuestToken,
  isGuestLinkActive,
  sanitizeDownloadName,
} from "@/src/lib/server/guest-links-core.js";

export {
  buildGuestZipPath,
  canGuestAccessFile,
  createGuestToken,
  isGuestLinkActive,
  sanitizeDownloadName,
};

const guestProjectInclude = {
  files: true,
  category: true,
  creator: true,
  creatorFolder: true,
} satisfies Prisma.ProjectInclude;

type GuestProjectRecord = Prisma.ProjectGetPayload<{ include: typeof guestProjectInclude }>;
type ActiveGuestLinkRecord = Prisma.ProjectGuestLinkGetPayload<{
  include: { project: { include: typeof guestProjectInclude } };
}>;

function toFileType(value: string): FileType {
  if (["F3D", "STL", "OBJ", "3MF", "STEP", "GCODE", "AMF", "PLY", "ZIP", "ARCHIVE", "PDF"].includes(value)) {
    return value as FileType;
  }
  return "STL";
}

export function mapGuestFile(file: GuestProjectRecord["files"][number]): PrintFile {
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    type: toFileType(file.type),
    sizeBytes: Number(file.sizeBytes),
    sizeLabel: humanFileSize(Number(file.sizeBytes)),
    mimeType: file.mimeType ?? undefined,
    originalPath: file.originalPath ?? undefined,
    folderPath: file.folderPath ?? undefined,
    storedPath: file.storedPath,
    notes: file.notes,
    source: file.source.toLowerCase() as PrintFile["source"],
    uploadedAt: file.uploadedAt.toISOString(),
    extractedFromZip: file.extractedFromZip ?? undefined,
  };
}

export function mapGuestProject(project: GuestProjectRecord): Project {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    coverLabel: project.coverLabel ?? project.title.slice(0, 8).toUpperCase(),
    coverGradient: project.coverGradient ?? "",
    tags: Array.isArray(project.tags) ? project.tags.map(String) : [],
    categoryId: project.categoryId ?? "",
    creatorId: project.creatorId ?? undefined,
    creatorFolderId: project.creatorFolderId ?? undefined,
    license: project.license,
    author: project.author,
    sourceUrl: project.sourceUrl ?? undefined,
    sourcePlatform: project.sourcePlatform ?? undefined,
    coverImage: project.coverImage ?? undefined,
    thumbnailFileId: project.thumbnailFileId ?? undefined,
    lockedFields: Array.isArray(project.lockedFields)
      ? project.lockedFields.map(String) as Project["lockedFields"]
      : [],
    favorite: false,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    files: project.files.map(mapGuestFile),
  };
}

export async function getActiveGuestLink(token: string): Promise<ActiveGuestLinkRecord | null> {
  const link = await prisma.projectGuestLink.findUnique({
    where: { token },
    include: {
      project: {
        include: guestProjectInclude,
      },
    },
  });

  if (!link || !isGuestLinkActive(link)) {
    return null;
  }

  return link;
}

export async function getGuestProjectByToken(token: string) {
  const link = await getActiveGuestLink(token);
  if (!link) return null;
  return {
    link,
    project: mapGuestProject(link.project),
  };
}
