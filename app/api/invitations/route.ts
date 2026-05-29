import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { generateInviteToken } from "@/src/lib/server/auth/invite";
import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  canUpload: z.boolean().default(false),
  readOnly: z.boolean().default(false),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (!access.permissions.canManageUsers) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const invites = await prisma.workspaceInvite.findMany({
    where: {
      workspaceId: access.membership.workspaceId,
    },
    include: {
      invitedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ acceptedAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    workspace: {
      id: access.membership.workspaceId,
      name: access.membership.workspace.name,
    },
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      canUpload: invite.canUpload,
      readOnly: invite.readOnly,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      invitedByName: invite.invitedBy?.name ?? "",
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
    const body = createInvitationSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existingMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: access.membership.workspaceId,
        user: { email },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "Dieser Benutzer ist dem Workspace bereits zugeordnet." },
        { status: 409 },
      );
    }

    const existingInvite = await prisma.workspaceInvite.findFirst({
      where: {
        workspaceId: access.membership.workspaceId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "Für diese E-Mail existiert bereits eine aktive Einladung." },
        { status: 409 },
      );
    }

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: access.membership.workspaceId,
        email,
        token: generateInviteToken(),
        role: body.role,
        canUpload: body.canUpload,
        readOnly: body.readOnly,
        invitedByUserId: access.session.user.id,
        expiresAt: new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: access.membership.workspaceId,
        userId: access.session.user.id,
        action: "invite.create",
        entityType: "invite",
        entityId: invite.id,
        message: `Invitation created for ${email}.`,
      },
    });

    return NextResponse.json({
      ok: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        canUpload: invite.canUpload,
        readOnly: invite.readOnly,
        token: invite.token,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Einladung konnte nicht erstellt werden." },
      { status: 400 },
    );
  }
}
