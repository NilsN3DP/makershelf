import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { hashPassword, verifyPassword } from "@/src/lib/server/auth/password";
import { prisma } from "@/src/lib/server/prisma";

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(256),
});

export async function PATCH(request: Request) {
  const session = await getSessionFromCookieStore();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    const body = updatePasswordSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Benutzer nicht gefunden." }, { status: 404 });
    }

    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Aktuelles Passwort ist ungueltig." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(body.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, forcePasswordChange: false },
    });

    return NextResponse.json({ ok: true, message: "Passwort aktualisiert." });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Passwort konnte nicht aktualisiert werden.",
      },
      { status: 400 },
    );
  }
}
