import { UserRole } from "@prisma/client";

import { prisma } from "@/src/lib/server/prisma";

export async function ensureFirstUserAdmin(userId: string) {
  const [userCount, workspace] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  if (userCount !== 1 || !workspace) {
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        role: UserRole.ADMIN,
        status: "ACTIVE",
      },
    }),
    prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId,
        },
      },
      update: {
        role: UserRole.ADMIN,
        canUpload: true,
        readOnly: false,
        status: "ACTIVE",
      },
      create: {
        workspaceId: workspace.id,
        userId,
        role: UserRole.ADMIN,
        canUpload: true,
        readOnly: false,
        status: "ACTIVE",
      },
    }),
  ]);
}
