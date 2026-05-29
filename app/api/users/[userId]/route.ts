import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/src/lib/server/auth/password";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const updateUserSchema = z.object({
  role: z.nativeEnum(UserRole),
  canUpload: z.boolean(),
  readOnly: z.boolean(),
});

const securitySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reset-2fa"),
  }),
  z.object({
    action: z.literal("set-password"),
    password: z.string().min(8).max(256),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  try {
    const { userId } = await context.params;
    const body = updateUserSchema.parse(await request.json());

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: access.membership.workspaceId,
        userId,
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    if (membership.userId === access.session.user.id && body.readOnly) {
      return NextResponse.json(
        { error: "Der eigene Admin-Zugang kann nicht auf Read-only gesetzt werden." },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({
        where: { id: membership.id },
        data: {
          role: body.role,
          canUpload: body.canUpload,
          readOnly: body.readOnly,
        },
      });

      await tx.user.update({
        where: { id: membership.userId },
        data: {
          role: body.role,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: access.membership.workspaceId,
          userId: access.session.user.id,
          action: "user.update",
          entityType: "user",
          entityId: membership.userId,
          message: `User ${membership.user.email} permissions updated.`,
          metadata: body,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Benutzer konnte nicht aktualisiert werden.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const { userId } = await context.params;

  if (userId === access.session.user.id) {
    return NextResponse.json(
      { error: "Der aktuell angemeldete Admin kann nicht entfernt werden." },
      { status: 400 },
    );
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: access.membership.workspaceId,
      userId,
    },
    include: {
      user: true,
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.delete({
      where: { id: membership.id },
    });

    const remainingMemberships = await tx.workspaceMember.count({
      where: { userId },
    });

    if (remainingMemberships === 0) {
      await tx.session.deleteMany({
        where: { userId },
      });
      await tx.user.delete({
        where: { id: userId },
      });
    }

    await tx.auditLog.create({
      data: {
        workspaceId: access.membership.workspaceId,
        userId: access.session.user.id,
        action: "user.remove",
        entityType: "user",
        entityId: userId,
        message: `User ${membership.user.email} removed from workspace.`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  try {
    const { userId } = await context.params;
    const body = securitySchema.parse(await request.json());

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: access.membership.workspaceId,
        userId,
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    if (body.action === "reset-2fa") {
      await prisma.$transaction(async (tx) => {
        await tx.twoFactorSecret.deleteMany({
          where: { userId },
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            twoFactorEnabled: false,
          },
        });
        await tx.session.updateMany({
          where: { userId },
          data: {
            twoFactorAt: null,
          },
        });
        await tx.auditLog.create({
          data: {
            workspaceId: access.membership.workspaceId,
            userId: access.session.user.id,
            action: "user.reset_2fa",
            entityType: "user",
            entityId: userId,
            message: `2FA reset for ${membership.user.email}.`,
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    const passwordHash = await hashPassword(body.password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
        },
      });
      await tx.session.deleteMany({
        where: {
          userId,
          NOT: { id: access.session.id },
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: access.membership.workspaceId,
          userId: access.session.user.id,
          action: "user.set_password",
          entityType: "user",
          entityId: userId,
          message: `Password updated for ${membership.user.email}.`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Sicherheitsaktion konnte nicht ausgefuehrt werden.",
      },
      { status: 400 },
    );
  }
}
