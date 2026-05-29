import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { prisma } from "@/src/lib/server/prisma";

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  locale: z.enum(["de", "en"]).default("de"),
});

export async function PATCH(request: Request) {
  const session = await getSessionFromCookieStore();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    const body = updateProfileSchema.parse(await request.json());

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: body.name,
        locale: body.locale,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        locale: user.locale,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.",
      },
      { status: 400 },
    );
  }
}
