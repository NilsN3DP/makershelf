import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/src/lib/server/auth/password";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(256),
  role: z.nativeEnum(UserRole),
  canUpload: z.boolean().default(false),
  readOnly: z.boolean().default(false),
});

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: access.membership.workspaceId },
    include: {
      user: {
        include: {
          twoFactorSecret: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    workspace: {
      id: access.membership.workspaceId,
      name: access.membership.workspace.name,
    },
    users: members.map((member) => ({
      membershipId: member.id,
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      canUpload: member.canUpload,
      readOnly: member.readOnly,
      status: member.status,
      twoFactorEnabled: member.user.twoFactorEnabled,
      twoFactorVerified: Boolean(member.user.twoFactorSecret?.verifiedAt),
      authProvider: member.user.authProvider,
      ldapDn: member.user.ldapDn ?? null,
      createdAt: member.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  try {
    const body = createUserSchema.parse(await request.json());
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        memberships: {
          where: { workspaceId: access.membership.workspaceId },
        },
      },
    });

    if (existingUser?.memberships.length) {
      return NextResponse.json(
        { error: "Dieser Benutzer ist dem Workspace bereits zugeordnet." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(body.password);

    const result = await prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            name: body.name,
            email: body.email.toLowerCase(),
            passwordHash,
            role: body.role,
            locale: "de",
            forcePasswordChange: true,
          },
        }));

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: body.name,
            role: body.role,
            passwordHash,
            forcePasswordChange: true,
          },
        });
      }

      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: access.membership.workspaceId,
          userId: user.id,
          role: body.role,
          canUpload: body.canUpload,
          readOnly: body.readOnly,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: access.membership.workspaceId,
          userId: access.session.user.id,
          action: "user.create",
          entityType: "user",
          entityId: user.id,
          message: `User ${body.email.toLowerCase()} added to workspace.`,
          metadata: {
            role: body.role,
            canUpload: body.canUpload,
            readOnly: body.readOnly,
          },
        },
      });

      return { user, membership };
    });

    return NextResponse.json({
      membershipId: result.membership.id,
      userId: result.user.id,
      name: body.name,
      email: body.email.toLowerCase(),
      role: body.role,
      canUpload: body.canUpload,
      readOnly: body.readOnly,
      status: "ACTIVE",
      twoFactorEnabled: false,
      twoFactorVerified: false,
      forcePasswordChange: true,
      createdAt: result.membership.createdAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Benutzer konnte nicht erstellt werden.",
      },
      { status: 400 },
    );
  }
}
