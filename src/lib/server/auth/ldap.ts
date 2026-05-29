import { Client, InvalidCredentialsError } from "ldapts";
import { UserRole } from "@prisma/client";

import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

export type LdapAuthResult =
  | { ok: true; email: string; name: string; role: UserRole; dn: string }
  | { ok: false; error: string };

export type LdapConfig = {
  enabled: boolean;
  url: string;
  bindDn: string;
  searchBase: string;
  searchFilter: string;
  attrEmail: string;
  attrName: string;
  groupSearchBase: string;
  groupAttrMember: string;
  groupMapAdmin: string[];
  groupMapEditor: string[];
  groupMapUploader: string[];
  defaultRole: UserRole;
  bindPassword?: string;
};

type StoredLdapSettings = Partial<
  Pick<
    LdapConfig,
    | "enabled"
    | "url"
    | "bindDn"
    | "bindPassword"
    | "searchBase"
    | "searchFilter"
    | "attrEmail"
    | "attrName"
    | "groupSearchBase"
    | "groupAttrMember"
    | "groupMapAdmin"
    | "groupMapEditor"
    | "groupMapUploader"
    | "defaultRole"
  >
>;

export function getLdapConfig(): LdapConfig | null {
  const env = getServerEnv();
  if (env.MAKERSHELF_LDAP_ENABLED !== "true") return null;
  if (!env.MAKERSHELF_LDAP_URL || !env.MAKERSHELF_LDAP_BIND_DN || !env.MAKERSHELF_LDAP_SEARCH_BASE) return null;

  return {
    enabled: true,
    url: env.MAKERSHELF_LDAP_URL,
    bindDn: env.MAKERSHELF_LDAP_BIND_DN,
    searchBase: env.MAKERSHELF_LDAP_SEARCH_BASE,
    searchFilter: env.MAKERSHELF_LDAP_SEARCH_FILTER ?? "(mail={{username}})",
    attrEmail: env.MAKERSHELF_LDAP_ATTR_EMAIL ?? "mail",
    attrName: env.MAKERSHELF_LDAP_ATTR_NAME ?? "cn",
    groupSearchBase: env.MAKERSHELF_LDAP_GROUP_SEARCH_BASE ?? env.MAKERSHELF_LDAP_SEARCH_BASE,
    groupAttrMember: env.MAKERSHELF_LDAP_GROUP_ATTR_MEMBER ?? "member",
    groupMapAdmin: splitGroups(env.MAKERSHELF_LDAP_GROUP_MAP_ADMIN),
    groupMapEditor: splitGroups(env.MAKERSHELF_LDAP_GROUP_MAP_EDITOR),
    groupMapUploader: splitGroups(env.MAKERSHELF_LDAP_GROUP_MAP_UPLOADER),
    defaultRole: env.MAKERSHELF_LDAP_DEFAULT_ROLE ?? UserRole.READER,
    bindPassword: env.MAKERSHELF_LDAP_BIND_PASSWORD ?? "",
  };
}

function isStoredLdapSettings(value: unknown): value is StoredLdapSettings {
  return Boolean(value && typeof value === "object");
}

function parseStoredGroups(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  }
  return splitGroups(typeof value === "string" ? value : undefined);
}

function getLdapSettingsFromJson(settingsJson: unknown): StoredLdapSettings | null {
  if (!settingsJson || typeof settingsJson !== "object") {
    return null;
  }

  const settings = settingsJson as { ldap?: unknown };
  return isStoredLdapSettings(settings.ldap) ? settings.ldap : null;
}

function buildLdapConfigFromStoredSettings(settings: StoredLdapSettings | null) {
  if (!settings?.enabled) {
    return null;
  }

  if (!settings.url || !settings.bindDn || !settings.searchBase) {
    return null;
  }

  return {
    enabled: true,
    url: settings.url,
    bindDn: settings.bindDn,
    bindPassword: settings.bindPassword ?? "",
    searchBase: settings.searchBase,
    searchFilter: settings.searchFilter ?? "(mail={{username}})",
    attrEmail: settings.attrEmail ?? "mail",
    attrName: settings.attrName ?? "cn",
    groupSearchBase: settings.groupSearchBase ?? settings.searchBase,
    groupAttrMember: settings.groupAttrMember ?? "member",
    groupMapAdmin: parseStoredGroups(settings.groupMapAdmin),
    groupMapEditor: parseStoredGroups(settings.groupMapEditor),
    groupMapUploader: parseStoredGroups(settings.groupMapUploader),
    defaultRole: settings.defaultRole ?? UserRole.READER,
  } satisfies LdapConfig;
}

export async function getEffectiveLdapConfig(workspaceId?: string): Promise<LdapConfig | null> {
  const workspace = await prisma.workspace.findFirst({
    where: workspaceId ? { id: workspaceId } : undefined,
    select: { settingsJson: true },
  });
  const storedConfig = buildLdapConfigFromStoredSettings(
    getLdapSettingsFromJson(workspace?.settingsJson),
  );

  return storedConfig ?? getLdapConfig();
}

function splitGroups(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function makeClient(url: string): Client {
  return new Client({
    url,
    tlsOptions: { rejectUnauthorized: false },
    connectTimeout: 5000,
  });
}

function buildFilter(template: string, username: string): string {
  return template.replace(/\{\{username\}\}/g, escapeLdapFilter(username));
}

function escapeLdapFilter(value: string): string {
  return value
    .replace(/\\/g, "\\5c")
    .replace(/\*/g, "\\2a")
    .replace(/\(/g, "\\28")
    .replace(/\)/g, "\\29")
    .replace(/\0/g, "\\00");
}

function resolveRoleFromGroups(
  userDn: string,
  groupDns: string[],
  config: LdapConfig,
): UserRole {
  const normalized = groupDns.map((g) => g.toLowerCase());
  const userDnLower = userDn.toLowerCase();

  const inGroup = (mappings: string[]) =>
    mappings.some((m) => normalized.some((g) => g === m || g.includes(m)) || userDnLower.includes(m));

  if (inGroup(config.groupMapAdmin)) return UserRole.ADMIN;
  if (inGroup(config.groupMapEditor)) return UserRole.EDITOR;
  if (inGroup(config.groupMapUploader)) return UserRole.UPLOADER;
  return config.defaultRole;
}

export async function authenticateLdapUser(
  username: string,
  password: string,
  workspaceId?: string,
): Promise<LdapAuthResult> {
  const config = await getEffectiveLdapConfig(workspaceId);
  if (!config) {
    return { ok: false, error: "LDAP ist nicht konfiguriert." };
  }

  const bindPassword = config.bindPassword ?? "";

  const client = makeClient(config.url);

  try {
    // Bind as service account to search for the user
    await client.bind(config.bindDn, bindPassword);

    const filter = buildFilter(config.searchFilter, username);
    const { searchEntries } = await client.search(config.searchBase, {
      scope: "sub",
      filter,
      attributes: ["dn", config.attrEmail, config.attrName, "memberOf"],
    });

    if (searchEntries.length === 0) {
      return { ok: false, error: "Benutzer wurde im Verzeichnis nicht gefunden." };
    }

    const entry = searchEntries[0];
    const userDn = entry.dn;
    const email = String(entry[config.attrEmail] ?? username).toLowerCase();
    const name = String(entry[config.attrName] ?? username);

    // Verify the user's password by binding as them
    const userClient = makeClient(config.url);
    try {
      await userClient.bind(userDn, password);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return { ok: false, error: "Passwort ist ungültig." };
      }
      throw err;
    } finally {
      await userClient.unbind();
    }

    // Collect group memberships (memberOf attribute + optional group search)
    const memberOf: string[] = [];
    const memberOfAttr = entry["memberOf"];
    if (Array.isArray(memberOfAttr)) {
      memberOf.push(...memberOfAttr.map(String));
    } else if (typeof memberOfAttr === "string" && memberOfAttr) {
      memberOf.push(memberOfAttr);
    }

    if (config.groupSearchBase && memberOf.length === 0) {
      const groupFilter = `(${config.groupAttrMember}=${escapeLdapFilter(userDn)})`;
      const groupResult = await client.search(config.groupSearchBase, {
        scope: "sub",
        filter: groupFilter,
        attributes: ["dn"],
      });
      memberOf.push(...groupResult.searchEntries.map((g) => g.dn));
    }

    const role = resolveRoleFromGroups(userDn, memberOf, config);

    return { ok: true, email, name, role, dn: userDn };
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return { ok: false, error: "LDAP-Zugangsdaten sind ungültig." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `LDAP-Verbindungsfehler: ${message}` };
  } finally {
    await client.unbind();
  }
}

export async function testLdapConnection(workspaceId?: string): Promise<{ ok: boolean; message: string }> {
  const config = await getEffectiveLdapConfig(workspaceId);
  if (!config) {
    return { ok: false, message: "LDAP ist nicht aktiviert oder unvollständig konfiguriert." };
  }

  const bindPassword = config.bindPassword ?? "";
  const client = makeClient(config.url);

  try {
    await client.bind(config.bindDn, bindPassword);
    await client.unbind();
    return {
      ok: true,
      message: `Verbindung zu ${config.url} erfolgreich. Service-Account gebunden als ${config.bindDn}.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Verbindung fehlgeschlagen: ${message}` };
  }
}
