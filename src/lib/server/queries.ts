import { prisma } from "@/src/lib/server/prisma";

export async function getWorkspaceSnapshotData(workspaceId: string) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      categories: true,
      creators: {
        include: {
          folders: true,
        },
      },
      lists: {
        include: {
          entries: true,
        },
      },
      projects: {
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          files: true,
          steps: true,
          shoppingItems: true,
          links: true,
          printedFiles: true,
          guestLinks: true,
        },
      },
    },
  });
}
