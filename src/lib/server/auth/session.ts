import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { constantTimeMatch, generateSessionToken } from "@/src/lib/server/auth/password";
import { prisma } from "@/src/lib/server/prisma";

export const AUTH_COOKIE_NAME = "makershelf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId: string, metadata?: { userAgent?: string; ipAddress?: string }) {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export async function invalidateSession(token: string) {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({
    where: { tokenHash },
  });
}

export async function getSessionFromCookieStore() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              workspace: true,
            },
          },
          twoFactorSecret: true,
        },
      },
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  if (!constantTimeMatch(tokenHash, session.tokenHash)) {
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session;
}
