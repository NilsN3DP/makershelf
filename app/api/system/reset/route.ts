import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { isDemoModeEnabled } from "@/src/lib/demo-mode-core";
import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

export async function POST() {
  try {
    const env = getServerEnv();
    if (isDemoModeEnabled(env.MAKERSHELF_DEMO_MODE)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reset ist in der Demo-Instanz deaktiviert.",
        },
        { status: 403 },
      );
    }

    const [workspaceCount, userCount] = await Promise.all([
      prisma.workspace.count(),
      prisma.user.count(),
    ]);
    const allowLocalRecoveryReset =
      process.env.NODE_ENV !== "production" && env.DATABASE_PROVIDER === "sqlite";
    const hasExistingData = workspaceCount > 0 || userCount > 0;

    if (hasExistingData) {
      const session = await getSessionFromCookieStore();

      if ((!session || session.user.role !== "ADMIN") && !allowLocalRecoveryReset) {
        return NextResponse.json(
          {
            ok: false,
            error: "Nur ein Admin darf den Server zurücksetzen.",
          },
          { status: 403 },
        );
      }

      await prisma.workspace.deleteMany();
      await prisma.user.deleteMany();
    }

    const response = NextResponse.json({
      ok: true,
      message: allowLocalRecoveryReset
        ? "Server setup reset in local recovery mode."
        : "Server setup reset.",
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reset failed.",
      },
      { status: 500 },
    );
  }
}
