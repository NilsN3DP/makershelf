import { NextResponse } from "next/server";

import { resolvePermissions } from "@/src/lib/server/permissions";
import { ensureFirstUserAdmin } from "@/src/lib/server/admin-integrity";
import { getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { isDemoModeEnabled } from "@/src/lib/demo-mode-core";
import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

function readMultiUserFlag(settingsJson: unknown, userCount: number): boolean {
  if (settingsJson && typeof settingsJson === "object") {
    const value = (settingsJson as Record<string, unknown>).multiUserEnabled;
    if (typeof value === "boolean") {
      return value;
    }
  }
  return userCount > 1;
}

export async function GET() {
  try {
    const env = getServerEnv();
    const [userCount, session, workspace] = await Promise.all([
      prisma.user.count(),
      getSessionFromCookieStore(),
      prisma.workspace.findFirst({ select: { settingsJson: true } }),
    ]);
    const multiUserEnabled = readMultiUserFlag(workspace?.settingsJson, userCount);
    const demoMode = isDemoModeEnabled(env.MAKERSHELF_DEMO_MODE);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        bootstrapRequired: userCount === 0,
        multiUserEnabled,
      });
    }

    await ensureFirstUserAdmin(session.user.id);
    const refreshedUser =
      (await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          memberships: {
            include: {
              workspace: true,
            },
          },
        },
      })) ?? session.user;
    const membership = refreshedUser.memberships[0];
    const permissions = membership
      ? resolvePermissions(membership.role, {
          canUpload: membership.canUpload,
          readOnly: membership.readOnly,
        })
      : null;

    const membershipSettings = readMultiUserFlag(
      membership?.workspace?.settingsJson,
      userCount,
    );

    return NextResponse.json({
      authenticated: true,
      bootstrapRequired: userCount === 0,
      multiUserEnabled: membershipSettings,
      user: {
        id: refreshedUser.id,
        email: refreshedUser.email,
        name: refreshedUser.name,
        role: refreshedUser.role,
        twoFactorEnabled: demoMode ? true : refreshedUser.twoFactorEnabled,
        forcePasswordChange: demoMode ? false : refreshedUser.forcePasswordChange,
      },
      workspace: membership?.workspace
        ? {
            id: membership.workspace.id,
            name: membership.workspace.name,
            slug: membership.workspace.slug,
          }
        : null,
      permissions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        authenticated: false,
        error: error instanceof Error ? error.message : "Session could not be loaded.",
      },
      { status: 500 },
    );
  }
}
