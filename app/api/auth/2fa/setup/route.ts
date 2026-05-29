import { NextResponse } from "next/server";

import {
  createBackupCodes,
  createTotpSecret,
  encryptTotpSecret,
  hashBackupCodes,
} from "@/src/lib/server/auth/totp";
import { getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

export async function POST() {
  const session = await getSessionFromCookieStore();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  const env = getServerEnv();
  const { secret, otpauthUrl } = createTotpSecret(env.MAKERSHELF_APP_NAME, session.user.email);
  const backupCodes = createBackupCodes();
  const encryptedSecret = encryptTotpSecret(secret);
  const hashedBackupCodes = hashBackupCodes(backupCodes);

  await prisma.twoFactorSecret.upsert({
    where: { userId: session.user.id },
    update: {
      secret: encryptedSecret,
      backupCodes: hashedBackupCodes,
      verifiedAt: null,
    },
    create: {
      userId: session.user.id,
      secret: encryptedSecret,
      backupCodes: hashedBackupCodes,
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: false },
  });

  return NextResponse.json({
    ok: true,
    otpauthUrl,
    backupCodes,
  });
}
