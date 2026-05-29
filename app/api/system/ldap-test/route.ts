import { NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/src/lib/server/request-context";
import { testLdapConnection, getEffectiveLdapConfig } from "@/src/lib/server/auth/ldap";

export async function GET() {
  const ctx = await requireWorkspaceAccess();
  if (!ctx.ok) return ctx.response;
  if (!ctx.permissions.canManageSettings) {
    return NextResponse.json({ ok: false, error: "Keine Berechtigung." }, { status: 403 });
  }

  const config = await getEffectiveLdapConfig(ctx.membership.workspaceId);
  if (!config) {
    return NextResponse.json({
      ok: false,
      enabled: false,
      message: "LDAP ist nicht aktiviert. Setze MAKERSHELF_LDAP_ENABLED=true und weitere LDAP-Variablen.",
    });
  }

  const result = await testLdapConnection(ctx.membership.workspaceId);
  return NextResponse.json({ ...result, enabled: true });
}
