import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const ldapSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().trim().default(""),
  bindDn: z.string().trim().default(""),
  bindPassword: z.string().optional().default(""),
  searchBase: z.string().trim().default(""),
  searchFilter: z.string().trim().default("(mail={{username}})"),
  attrEmail: z.string().trim().default("mail"),
  attrName: z.string().trim().default("cn"),
  groupSearchBase: z.string().trim().default(""),
  groupAttrMember: z.string().trim().default("member"),
  groupMapAdmin: z.string().trim().default(""),
  groupMapEditor: z.string().trim().default(""),
  groupMapUploader: z.string().trim().default(""),
  defaultRole: z.nativeEnum(UserRole).default(UserRole.READER),
});

function getSettingsObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function getLdapObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function toPublicLdapSettings(settingsJson: unknown) {
  const root = getSettingsObject(settingsJson);
  const ldap = getLdapObject(root.ldap);

  return {
    enabled: Boolean(ldap.enabled),
    url: String(ldap.url ?? ""),
    bindDn: String(ldap.bindDn ?? ""),
    hasBindPassword: Boolean(ldap.bindPassword),
    searchBase: String(ldap.searchBase ?? ""),
    searchFilter: String(ldap.searchFilter ?? "(mail={{username}})"),
    attrEmail: String(ldap.attrEmail ?? "mail"),
    attrName: String(ldap.attrName ?? "cn"),
    groupSearchBase: String(ldap.groupSearchBase ?? ""),
    groupAttrMember: String(ldap.groupAttrMember ?? "member"),
    groupMapAdmin: Array.isArray(ldap.groupMapAdmin)
      ? ldap.groupMapAdmin.join(", ")
      : String(ldap.groupMapAdmin ?? ""),
    groupMapEditor: Array.isArray(ldap.groupMapEditor)
      ? ldap.groupMapEditor.join(", ")
      : String(ldap.groupMapEditor ?? ""),
    groupMapUploader: Array.isArray(ldap.groupMapUploader)
      ? ldap.groupMapUploader.join(", ")
      : String(ldap.groupMapUploader ?? ""),
    defaultRole: Object.values(UserRole).includes(ldap.defaultRole as UserRole)
      ? (ldap.defaultRole as UserRole)
      : UserRole.READER,
  };
}

function splitGroupMap(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  if (!access.permissions.canManageSettings) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  return NextResponse.json({
    ldap: toPublicLdapSettings(access.membership.workspace.settingsJson),
  });
}

export async function PATCH(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  if (!access.permissions.canManageSettings) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = ldapSettingsSchema.parse(await request.json());
  const currentRoot = getSettingsObject(access.membership.workspace.settingsJson);
  const currentLdap = getLdapObject(currentRoot.ldap);
  const existingBindPassword =
    typeof currentLdap.bindPassword === "string" ? currentLdap.bindPassword : undefined;
  const nextLdap = {
    enabled: body.enabled,
    url: body.url,
    bindDn: body.bindDn,
    bindPassword: body.bindPassword ? body.bindPassword : existingBindPassword,
    searchBase: body.searchBase,
    searchFilter: body.searchFilter || "(mail={{username}})",
    attrEmail: body.attrEmail || "mail",
    attrName: body.attrName || "cn",
    groupSearchBase: body.groupSearchBase || body.searchBase,
    groupAttrMember: body.groupAttrMember || "member",
    groupMapAdmin: splitGroupMap(body.groupMapAdmin),
    groupMapEditor: splitGroupMap(body.groupMapEditor),
    groupMapUploader: splitGroupMap(body.groupMapUploader),
    defaultRole: body.defaultRole,
  };

  const workspace = await prisma.workspace.update({
    where: { id: access.membership.workspaceId },
    data: {
      settingsJson: {
        ...currentRoot,
        ldap: nextLdap,
      },
    },
    select: { settingsJson: true },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: access.membership.workspaceId,
      userId: access.session.user.id,
      action: "workspace.ldap.update",
      entityType: "workspace",
      entityId: access.membership.workspaceId,
      message: body.enabled ? "LDAP settings updated." : "LDAP disabled.",
      metadata: {
        enabled: body.enabled,
        url: body.url,
        searchBase: body.searchBase,
        defaultRole: body.defaultRole,
      },
    },
  });

  return NextResponse.json({ ldap: toPublicLdapSettings(workspace.settingsJson) });
}
