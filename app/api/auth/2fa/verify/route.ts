import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { verifyTotpToken } from "@/src/lib/server/auth/totp";
import { prisma } from "@/src/lib/server/prisma";

const verifySchema = z.object({
  token: z.string().trim().min(6).max(12),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookieStore();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = verifySchema.parse(await request.json());
  const stored = await prisma.twoFactorSecret.findUnique({
    where: { userId: session.user.id },
  });

  if (!stored) {
    return NextResponse.json(
      { ok: false, error: "Kein 2FA-Setup vorhanden." },
      { status: 400 },
    );
  }

  const valid = verifyTotpToken(stored.secret, body.token);
  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Authenticator-Code ist ungueltig." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.twoFactorSecret.update({
      where: { userId: session.user.id },
      data: { verifiedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true },
    }),
  ]);

  return NextResponse.json({ ok: true, message: "2FA aktiviert." });
}
