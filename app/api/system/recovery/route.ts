import { NextResponse } from "next/server";

import { hashPassword } from "@/src/lib/server/auth/password";
import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

const LOCAL_RECOVERY_PASSWORD = "ChangeMe123!";

function isLocalRecoveryEnabled() {
  const env = getServerEnv();
  return env.NODE_ENV !== "production" && env.DATABASE_PROVIDER === "sqlite";
}

export async function GET() {
  if (!isLocalRecoveryEnabled()) {
    return NextResponse.json({ error: "Recovery ist hier nicht verfügbar." }, { status: 403 });
  }

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const memberships = await prisma.workspaceMember.findMany({
    where: workspace ? { workspaceId: workspace.id } : undefined,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          twoFactorEnabled: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    recoveryAvailable: true,
    temporaryPassword: LOCAL_RECOVERY_PASSWORD,
    workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
    users: memberships.map((membership) => ({
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      readOnly: membership.readOnly,
      canUpload: membership.canUpload,
      twoFactorEnabled: membership.user.twoFactorEnabled,
    })),
  });
}

export async function POST(request: Request) {
  if (!isLocalRecoveryEnabled()) {
    return NextResponse.json({ error: "Recovery ist hier nicht verfügbar." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: workspace?.id,
      ...(body.email
        ? {
            user: {
              email: body.email.toLowerCase(),
            },
          }
        : {
            role: "ADMIN",
          }),
    },
    include: {
      user: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Es wurde kein passendes Konto für die Wiederherstellung gefunden." },
      { status: 404 },
    );
  }

  const passwordHash = await hashPassword(LOCAL_RECOVERY_PASSWORD);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: membership.userId },
      data: {
        passwordHash,
        twoFactorEnabled: false,
      },
    });

    await tx.twoFactorSecret.deleteMany({
      where: { userId: membership.userId },
    });

    await tx.session.deleteMany({
      where: { userId: membership.userId },
    });

    if (workspace) {
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          action: "system.recovery",
          entityType: "user",
          entityId: membership.userId,
          message: `Local recovery reset password for ${membership.user.email}.`,
          metadata: {
            email: membership.user.email,
            role: membership.role,
            temporaryPassword: LOCAL_RECOVERY_PASSWORD,
          },
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
    email: membership.user.email,
    name: membership.user.name,
    role: membership.role,
    temporaryPassword: LOCAL_RECOVERY_PASSWORD,
    message: "Temporäres Passwort wurde gesetzt und 2FA zurückgesetzt.",
  });
}
