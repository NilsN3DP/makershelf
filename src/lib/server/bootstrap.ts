import { UserRole } from "@prisma/client";

import { defaultCategories, defaultCreators, defaultSettings, slugify } from "@/src/lib/makershelf-data";
import {
  createBackupCodes,
  createTotpSecret,
  encryptTotpSecret,
  hashBackupCodes,
} from "@/src/lib/server/auth/totp";
import { hashPassword } from "@/src/lib/server/auth/password";
import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

export async function bootstrapWorkspaceWithAdmin(input: {
  workspaceName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  filamentVaultEnabled?: boolean;
}) {
  const env = getServerEnv();
  const existingUserCount = await prisma.user.count();
  const workspaceName = /open\s*printing\s*vault|makershelf/i.test(input.workspaceName)
    ? "makershelf"
    : input.workspaceName;

  if (existingUserCount > 0) {
    throw new Error("Bootstrap is only available before the first user exists.");
  }

  const passwordHash = await hashPassword(input.adminPassword);
  const workspaceSlug = slugify(workspaceName) || "makershelf";
  const { secret, otpauthUrl } = createTotpSecret(env.MAKERSHELF_APP_NAME, input.adminEmail);
  const backupCodes = createBackupCodes();
  const encryptedSecret = encryptTotpSecret(secret);
  const hashedBackupCodes = hashBackupCodes(backupCodes);

  const result = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        slug: workspaceSlug,
        name: workspaceName,
        deploymentMode: "docker-team",
        dataBackend: env.MAKERSHELF_DATA_BACKEND,
        language: "de",
        themeMode: "system",
        settingsJson: {
          multiUserEnabled: false,
          filamentVaultEnabled: Boolean(input.filamentVaultEnabled),
          filamentOpenPrintTagEnabled: defaultSettings.filamentOpenPrintTagEnabled,
          filamentTagBaseUrl: defaultSettings.filamentTagBaseUrl,
          filamentLowThresholdGrams: defaultSettings.filamentLowThresholdGrams,
          filamentDefaultTareGrams: defaultSettings.filamentDefaultTareGrams,
        },
      },
    });

    const user = await tx.user.create({
      data: {
        email: input.adminEmail.toLowerCase(),
        name: input.adminName,
        passwordHash,
        role: UserRole.ADMIN,
        locale: "de",
        twoFactorEnabled: true,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: UserRole.ADMIN,
        canUpload: true,
        readOnly: false,
      },
    });

    await tx.twoFactorSecret.create({
      data: {
        userId: user.id,
        secret: encryptedSecret,
        backupCodes: hashedBackupCodes,
        verifiedAt: new Date(),
      },
    });

    await tx.projectList.createMany({
      data: [
        {
          workspaceId: workspace.id,
          slug: "favorites",
          name: "Favoriten",
          isSystem: true,
        },
        {
          workspaceId: workspace.id,
          slug: "active-projects",
          name: "Aktive Projekte",
          isSystem: true,
        },
      ],
    });

    await tx.category.createMany({
      data: defaultCategories.map((category) => ({
        workspaceId: workspace.id,
        slug: slugify(category.name) || category.id,
        name: category.name,
        description: category.description,
        emoji: category.emoji,
        color: category.color,
      })),
    });

    for (const creator of defaultCreators) {
      const createdCreator = await tx.creator.create({
        data: {
          workspaceId: workspace.id,
          slug: slugify(creator.name) || creator.id,
          name: creator.name,
        },
      });

      if (creator.folders.length > 0) {
        await tx.creatorFolder.createMany({
          data: creator.folders.map((folder) => ({
            creatorId: createdCreator.id,
            slug: slugify(folder.name) || folder.id,
            name: folder.name,
          })),
        });
      }
    }

    await tx.auditLog.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "workspace.bootstrap",
        entityType: "workspace",
        entityId: workspace.id,
        message: "Initial workspace and administrator created.",
        metadata: {
          dataBackend: env.MAKERSHELF_DATA_BACKEND,
        },
      },
    });

    return { workspace, user };
  });

  return {
    workspaceId: result.workspace.id,
    userId: result.user.id,
    totpSetup: {
      secret,
      otpauthUrl,
      backupCodes,
    },
  };
}
