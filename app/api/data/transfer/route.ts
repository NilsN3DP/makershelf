import { NextResponse } from "next/server";

import type { AppSettings } from "@/src/lib/makershelf-data";
import { deleteStoredFileFromDisk } from "@/src/lib/server/file-storage";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

type TransferSettingsPayload = Partial<
  Pick<
    AppSettings,
    | "userName"
    | "language"
    | "themeMode"
    | "primaryColor"
    | "secondaryColor"
    | "preferredSlicer"
    | "debugMode"
    | "pageSize"
    | "dashboardFeaturedCount"
    | "maxPreviewFileSizeMb"
  >
>;

export async function DELETE() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canManageSettings) {
    return NextResponse.json({ ok: false, error: "Keine Berechtigung." }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    const projectFiles = await tx.projectFile.findMany({
      where: {
        project: {
          workspaceId: access.membership.workspaceId,
        },
      },
      select: {
        storedPath: true,
      },
    });

    await Promise.all(
      projectFiles.map((file) =>
        deleteStoredFileFromDisk({
          storedPath: file.storedPath,
          preferRuntimeRoot: true,
        }),
      ),
    );

    await tx.project.deleteMany({
      where: {
        workspaceId: access.membership.workspaceId,
      },
    });

    await tx.projectList.deleteMany({
      where: {
        workspaceId: access.membership.workspaceId,
      },
    });

    await tx.creator.deleteMany({
      where: {
        workspaceId: access.membership.workspaceId,
      },
    });

    await tx.category.deleteMany({
      where: {
        workspaceId: access.membership.workspaceId,
      },
    });

    await tx.workspace.update({
      where: {
        id: access.membership.workspaceId,
      },
      data: {
        settingsJson: {},
      },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canManageSettings) {
    return NextResponse.json({ ok: false, error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = (await request.json()) as { settings?: TransferSettingsPayload };
  const settings = body.settings ?? {};
  const settingsJson = Object.fromEntries(
    Object.entries({
      userName: settings.userName,
      preferredSlicer: settings.preferredSlicer,
      debugMode: settings.debugMode,
      pageSize: settings.pageSize,
      dashboardFeaturedCount: settings.dashboardFeaturedCount,
      maxPreviewFileSizeMb: settings.maxPreviewFileSizeMb,
    }).filter(([, value]) => value !== undefined),
  );

  await prisma.workspace.update({
    where: {
      id: access.membership.workspaceId,
    },
    data: {
      language: settings.language ?? undefined,
      themeMode: settings.themeMode ?? undefined,
      primaryColor: settings.primaryColor ?? undefined,
      secondaryColor: settings.secondaryColor ?? undefined,
      settingsJson,
    },
  });

  return NextResponse.json({ ok: true });
}
