import { MembershipStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/src/lib/server/auth/password";
import { prisma } from "@/src/lib/server/prisma";

const acceptInvitationSchema = z.object({
  token: z.string().min(12),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(256),
  locale: z.enum(["de", "en"]).default("de"),
});

export async function POST(request: Request) {
  try {
    const body = acceptInvitationSchema.parse(await request.json());

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: body.token },
      include: { workspace: true },
    });

    if (!invite) {
      return NextResponse.json({ ok: false, error: "Einladung nicht gefunden." }, { status: 404 });
    }

    if (invite.acceptedAt) {
      return NextResponse.json({ ok: false, error: "Einladung wurde bereits angenommen." }, { status: 400 });
    }

    if (invite.expiresAt <= new Date()) {
      return NextResponse.json({ ok: false, error: "Einladung ist abgelaufen." }, { status: 400 });
    }

    const passwordHash = await hashPassword(body.password);

    await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: invite.email },
      });

      const user =
        existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                name: body.name,
                passwordHash,
                role: invite.role,
                locale: body.locale,
                status: MembershipStatus.ACTIVE,
              },
            })
          : await tx.user.create({
              data: {
                email: invite.email,
                name: body.name,
                passwordHash,
                role: invite.role,
                locale: body.locale,
                status: MembershipStatus.ACTIVE,
              },
            });

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id,
          },
        },
        update: {
          role: invite.role,
          canUpload: invite.canUpload,
          readOnly: invite.readOnly,
          status: MembershipStatus.ACTIVE,
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
          canUpload: invite.canUpload,
          readOnly: invite.readOnly,
          status: MembershipStatus.ACTIVE,
        },
      });

      await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          action: "invite.accept",
          entityType: "invite",
          entityId: invite.id,
          message: `Invitation accepted for ${invite.email}.`,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      workspaceName: invite.workspace.name,
      message: "Einladung angenommen. Du kannst dich jetzt anmelden.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Einladung konnte nicht angenommen werden." },
      { status: 400 },
    );
  }
}
