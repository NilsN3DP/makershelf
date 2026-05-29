import { NextResponse } from "next/server";

import { getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { resolvePermissions } from "@/src/lib/server/permissions";

export async function requireWorkspaceAccess() {
  const session = await getSessionFromCookieStore();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
    };
  }

  const membership = session.user.memberships[0];
  if (!membership) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Kein Workspace zugeordnet." }, { status: 403 }),
    };
  }

  const permissions = resolvePermissions(membership.role, {
    canUpload: membership.canUpload,
    readOnly: membership.readOnly,
  });

  return {
    ok: true as const,
    session,
    membership,
    permissions,
  };
}
