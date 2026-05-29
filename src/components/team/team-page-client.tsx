"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { useToast } from "@/src/components/ui/toast";
import { text } from "@/src/lib/locale";

type TeamUser = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "UPLOADER" | "READER";
  canUpload: boolean;
  readOnly: boolean;
  status: string;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  authProvider: string;
  ldapDn: string | null;
  createdAt: string;
};

type Invite = {
  id: string;
  email: string;
  role: TeamUser["role"];
  canUpload: boolean;
  readOnly: boolean;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  invitedByName: string;
};

type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  message?: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
};

type LdapSettings = {
  enabled: boolean;
  url: string;
  bindDn: string;
  bindPassword: string;
  hasBindPassword: boolean;
  searchBase: string;
  searchFilter: string;
  attrEmail: string;
  attrName: string;
  groupSearchBase: string;
  groupAttrMember: string;
  groupMapAdmin: string;
  groupMapEditor: string;
  groupMapUploader: string;
  defaultRole: TeamUser["role"];
};

type TeamPayload = {
  workspace?: { id: string; name: string };
  users?: TeamUser[];
  error?: string;
};

const defaultLdapSettings: LdapSettings = {
  enabled: false,
  url: "",
  bindDn: "",
  bindPassword: "",
  hasBindPassword: false,
  searchBase: "",
  searchFilter: "(mail={{username}})",
  attrEmail: "mail",
  attrName: "cn",
  groupSearchBase: "",
  groupAttrMember: "member",
  groupMapAdmin: "",
  groupMapEditor: "",
  groupMapUploader: "",
  defaultRole: "READER",
};

export function TeamPageClient() {
  const { settings } = useMakershelf();
  const { toast } = useToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<TeamUser["role"]>("EDITOR");
  const [newCanUpload, setNewCanUpload] = useState(true);
  const [newReadOnly, setNewReadOnly] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamUser["role"]>("EDITOR");
  const [inviteCanUpload, setInviteCanUpload] = useState(true);
  const [inviteReadOnly, setInviteReadOnly] = useState(false);
  const [inviteDays, setInviteDays] = useState(7);
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [ldapTestResult, setLdapTestResult] = useState<{ ok: boolean; enabled: boolean; message: string } | null>(null);
  const [ldapTesting, setLdapTesting] = useState(false);
  const [ldapSettings, setLdapSettings] = useState<LdapSettings>(defaultLdapSettings);
  const [ldapSaving, setLdapSaving] = useState(false);
  const locale = settings.language === "de" ? "de-DE" : "en-US";

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  }

  async function copyInviteLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch {
      return false;
    }
  }

  function roleLabel(role: TeamUser["role"]) {
    return {
      ADMIN: "Admin",
      EDITOR: "Editor",
      UPLOADER: text(settings.language, "Uploader", "Uploader"),
      READER: text(settings.language, "Leser", "Reader"),
    }[role];
  }

  function twoFactorLabel(user: TeamUser) {
    if (user.twoFactorVerified) {
      return text(settings.language, "2FA verifiziert", "2FA verified");
    }
    if (user.twoFactorEnabled) {
      return text(settings.language, "2FA eingerichtet", "2FA configured");
    }
    return text(settings.language, "2FA nicht aktiv", "2FA not active");
  }

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/users");
      const payload = (await response.json()) as TeamPayload;
      if (!response.ok) {
        throw new Error(payload.error || "Benutzerdaten konnten nicht geladen werden.");
      }

      const inviteResponse = await fetch("/api/invitations");
      const invitePayload = (await inviteResponse.json()) as {
        invites?: Invite[];
        error?: string;
      };
      if (!inviteResponse.ok) {
        throw new Error(invitePayload.error || "Einladungen konnten nicht geladen werden.");
      }

      const auditResponse = await fetch("/api/audit");
      const auditPayload = (await auditResponse.json()) as {
        logs?: AuditLogEntry[];
        error?: string;
      };
      if (!auditResponse.ok) {
        throw new Error(auditPayload.error || "Aktivitäten konnten nicht geladen werden.");
      }

      setUsers(payload.users ?? []);
      setInvites(invitePayload.invites ?? []);
      setAuditLogs(auditPayload.logs ?? []);
      setWorkspaceName(payload.workspace?.name ?? "");

      const ldapResponse = await fetch("/api/system/ldap-settings");
      const ldapPayload = (await ldapResponse.json()) as {
        ldap?: Omit<LdapSettings, "bindPassword">;
        error?: string;
      };
      if (ldapResponse.ok && ldapPayload.ldap) {
        setLdapSettings({ ...defaultLdapSettings, ...ldapPayload.ldap, bindPassword: "" });
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Benutzerdaten konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateLdapSettings<K extends keyof LdapSettings>(key: K, value: LdapSettings[K]) {
    setLdapSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveLdapSettings() {
    setLdapSaving(true);
    setError("");
    try {
      const response = await fetch("/api/system/ldap-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ldapSettings),
      });
      const payload = (await response.json()) as {
        ldap?: Omit<LdapSettings, "bindPassword">;
        error?: string;
      };
      if (!response.ok || !payload.ldap) {
        throw new Error(payload.error || "LDAP-Einstellungen konnten nicht gespeichert werden.");
      }
      setLdapSettings({ ...defaultLdapSettings, ...payload.ldap, bindPassword: "" });
      toast(text(settings.language, "LDAP-Einstellungen gespeichert.", "LDAP settings saved."), "success");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "LDAP-Einstellungen konnten nicht gespeichert werden.",
      );
    } finally {
      setLdapSaving(false);
    }
  }

  async function testLdap() {
    setLdapTesting(true);
    setLdapTestResult(null);
    try {
      const response = await fetch("/api/system/ldap-test");
      const payload = (await response.json()) as { ok: boolean; enabled: boolean; message: string };
      setLdapTestResult(payload);
    } catch {
      setLdapTestResult({ ok: false, enabled: false, message: "Anfrage fehlgeschlagen." });
    } finally {
      setLdapTesting(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  if (loading && !users.length && !workspaceName) {
    return (
      <section className="panel p-6">
        <h1 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
          {text(settings.language, "Benutzer", "Users")}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {text(settings.language, "Benutzerdaten werden geladen...", "Loading users...")}
        </p>
      </section>
    );
  }

  if (error && !users.length && !invites.length) {
    return (
      <section className="panel p-6">
        <h1 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
          {text(settings.language, "Benutzer", "Users")}
        </h1>
        <p className="mt-3 text-sm text-red-200">{error}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/login" className="btn btn-primary">
            Login
          </a>
          <a href="/setup" className="btn btn-ghost">
            {text(settings.language, "Setup öffnen", "Open setup")}
          </a>
        </div>
      </section>
    );
  }

  if (!settings.multiUserEnabled) {
    return (
      <div className="panel panel-padded">
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Mehrbenutzermodus ist deaktiviert. Aktiviere ihn in den Einstellungen.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {text(settings.language, "Userverwaltung", "User management")}
          </h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              `Workspace: ${workspaceName || "makershelf"}. Verwalte Benutzer, Einladungen, Rollen, Upload-Rechte und Read-only-Zugriffe.`,
              "Manage users, invitations, roles, upload permissions and read-only access for team mode.",
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <a href="/settings" className="btn btn-secondary btn-sm">
            {text(settings.language, "Zu den Einstellungen", "Open settings")}
          </a>
          <a href="/projects" className="btn btn-secondary btn-sm">
            {text(settings.language, "Zu den Projekten", "Open projects")}
          </a>
        </div>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "1.25rem", alignItems: "start" }}>
        <section className="panel panel-padded">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
                {text(settings.language, "Benutzer anlegen", "Create user")}
              </h2>
                <p className="mt-2 text-sm text-muted">
                  {text(
                    settings.language,
                    "Lege Benutzer direkt an und weise Rolle sowie Zugriffsrechte sofort zu.",
                    "Create users directly and assign role and access rights right away.",
                  )}
                </p>
            </div>
            <form
              className="grid gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");

                try {
                  const response = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: newName,
                      email: newEmail,
                      password: newPassword,
                      role: newRole,
                      canUpload: newCanUpload,
                      readOnly: newReadOnly,
                    }),
                  });
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error || "Benutzer konnte nicht erstellt werden.");
                  }

                  setNewName("");
                  setNewEmail("");
                  setNewPassword("");
                  setNewRole("EDITOR");
                  setNewCanUpload(true);
                  setNewReadOnly(false);
                  toast(text(settings.language, "Benutzer angelegt.", "User created."), "success");
                  await loadUsers();
                } catch (nextError) {
                  setError(
                    nextError instanceof Error
                      ? nextError.message
                      : "Benutzer konnte nicht erstellt werden.",
                  );
                }
              }}
            >
              <input
                className="input"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={text(settings.language, "Name", "Name")}
                required
              />
              <input
                className="input"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="user@example.com"
                required
              />
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={text(settings.language, "Initiales Passwort", "Initial password")}
                minLength={8}
                required
              />
              <div className="grid gap-4 md:grid-cols-3">
                <select
                  className="input"
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as TeamUser["role"])}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="EDITOR">Editor</option>
                  <option value="UPLOADER">Uploader</option>
                  <option value="READER">Reader</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--panel-muted)", borderRadius: "8px", padding: "10px 14px", fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newCanUpload}
                    onChange={(event) => setNewCanUpload(event.target.checked)}
                  />
                  Upload
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--panel-muted)", borderRadius: "8px", padding: "10px 14px", fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newReadOnly}
                    onChange={(event) => setNewReadOnly(event.target.checked)}
                  />
                  {text(settings.language, "Nur lesen", "Read only")}
                </label>
              </div>
              <button className="btn btn-primary">
                {text(settings.language, "Benutzer speichern", "Save user")}
              </button>
            </form>

            <div className="border-t border-[var(--border)] pt-6">
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
                  {text(settings.language, "Einladung senden", "Send invitation")}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {text(
                    settings.language,
                    "Erzeuge einen Einladungslink, damit Nutzer ihren Zugang selbst abschließen können.",
                    "Generate an invitation link so users can finish their own access setup.",
                  )}
                </p>
              </div>
              <form
                className="mt-4 grid gap-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError("");
                  try {
                    const response = await fetch("/api/invitations", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: inviteEmail,
                        role: inviteRole,
                        canUpload: inviteCanUpload,
                        readOnly: inviteReadOnly,
                        expiresInDays: inviteDays,
                      }),
                    });
                    const payload = (await response.json()) as {
                      error?: string;
                      invite?: Invite;
                    };
                    if (!response.ok || !payload.invite) {
                      throw new Error(payload.error || "Einladung konnte nicht erstellt werden.");
                    }

                    const inviteLink = `${window.location.origin}/invite/${payload.invite.token}`;
                    setLastInviteLink(inviteLink);
                    setInviteEmail("");
                    setInviteRole("EDITOR");
                    setInviteCanUpload(true);
                    setInviteReadOnly(false);
                    setInviteDays(7);
                    const copied = await copyInviteLink(inviteLink);
                    await loadUsers();
                    toast(
                      copied
                        ? text(
                            settings.language,
                            "Einladung erstellt und Link in die Zwischenablage kopiert.",
                            "Invitation created and link copied to clipboard.",
                          )
                        : text(
                            settings.language,
                            "Einladung erstellt. Der Link ist unten sichtbar, konnte aber nicht automatisch kopiert werden.",
                            "Invitation created. The link is shown below, but it could not be copied automatically.",
                          ),
                      "success",
                    );
                  } catch (nextError) {
                    setError(
                      nextError instanceof Error
                        ? nextError.message
                        : "Einladung konnte nicht erstellt werden.",
                    );
                  }
                }}
              >
                <input
                  className="input"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="invite@example.com"
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className="input"
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as TeamUser["role"])}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="EDITOR">Editor</option>
                    <option value="UPLOADER">Uploader</option>
                    <option value="READER">Reader</option>
                  </select>
                  <select
                    className="input"
                    value={String(inviteDays)}
                    onChange={(event) => setInviteDays(Number(event.target.value))}
                  >
                    <option value="3">{text(settings.language, "3 Tage", "3 days")}</option>
                    <option value="7">{text(settings.language, "7 Tage", "7 days")}</option>
                    <option value="14">{text(settings.language, "14 Tage", "14 days")}</option>
                    <option value="30">{text(settings.language, "30 Tage", "30 days")}</option>
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--panel-muted)", borderRadius: "8px", padding: "10px 14px", fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inviteCanUpload}
                      onChange={(event) => setInviteCanUpload(event.target.checked)}
                    />
                    Upload
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--panel-muted)", borderRadius: "8px", padding: "10px 14px", fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={inviteReadOnly}
                      onChange={(event) => setInviteReadOnly(event.target.checked)}
                    />
                    {text(settings.language, "Nur lesen", "Read only")}
                  </label>
                </div>
                <button className="btn btn-secondary">
                  {text(settings.language, "Einladungslink erzeugen", "Generate invite link")}
                </button>
              </form>
              {lastInviteLink ? (
                <div className="surface-subtle mt-4 rounded-xl p-4">
                  <p className="text-sm font-semibold text-main">
                    {text(settings.language, "Letzter Einladungslink", "Latest invitation link")}
                  </p>
                  <p className="mt-2 break-all text-sm text-muted">{lastInviteLink}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={lastInviteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      {text(settings.language, "Öffnen", "Open")}
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        const copied = await copyInviteLink(lastInviteLink);
                        toast(
                          copied
                            ? text(settings.language, "Einladungslink kopiert.", "Invitation link copied.")
                            : text(
                                settings.language,
                                "Link konnte nicht automatisch kopiert werden. Bitte manuell kopieren.",
                                "The link could not be copied automatically. Please copy it manually.",
                              ),
                          "success",
                        );
                      }}
                      className="btn-secondary px-3 py-2 text-xs font-semibold"
                    >
                      {text(settings.language, "Erneut kopieren", "Copy again")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-[var(--border)] pt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
                  LDAP / Active Directory
                </h3>
                <button
                  type="button"
                  onClick={() => void testLdap()}
                  disabled={ldapTesting}
                  className="btn btn-ghost btn-sm"
                >
                  {ldapTesting
                    ? text(settings.language, "Teste...", "Testing...")
                    : text(settings.language, "Verbindung testen", "Test connection")}
                </button>
              </div>
              <p className="mt-2 text-sm text-muted">
                {text(
                  settings.language,
                  "LDAP-Anbindung für diesen Workspace konfigurieren. Benutzer werden beim ersten Login automatisch angelegt und ihre Rolle wird bei jedem Login aus LDAP-Gruppen synchronisiert.",
                  "Configure LDAP for this workspace. Users are auto-provisioned on first login and their role is synced from LDAP groups on every login.",
                )}
              </p>
              <form
                className="mt-4 grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveLdapSettings();
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--panel-muted)", borderRadius: "8px", padding: "10px 14px", fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={ldapSettings.enabled}
                    onChange={(event) => updateLdapSettings("enabled", event.target.checked)}
                  />
                  {text(settings.language, "LDAP Login aktivieren", "Enable LDAP login")}
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="input"
                    value={ldapSettings.url}
                    onChange={(event) => updateLdapSettings("url", event.target.value)}
                    placeholder="ldap://ldap.example.com:389"
                  />
                  <select
                    className="input"
                    value={ldapSettings.defaultRole}
                    onChange={(event) => updateLdapSettings("defaultRole", event.target.value as TeamUser["role"])}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="EDITOR">Editor</option>
                    <option value="UPLOADER">Uploader</option>
                    <option value="READER">Reader</option>
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="input"
                    value={ldapSettings.bindDn}
                    onChange={(event) => updateLdapSettings("bindDn", event.target.value)}
                    placeholder="cn=service,dc=example,dc=com"
                  />
                  <input
                    className="input"
                    type="password"
                    value={ldapSettings.bindPassword}
                    onChange={(event) => updateLdapSettings("bindPassword", event.target.value)}
                    placeholder={
                      ldapSettings.hasBindPassword
                        ? text(settings.language, "Passwort gesetzt - leer lassen zum Beibehalten", "Password set - leave empty to keep")
                        : "Bind password"
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="input"
                    value={ldapSettings.searchBase}
                    onChange={(event) => updateLdapSettings("searchBase", event.target.value)}
                    placeholder="ou=users,dc=example,dc=com"
                  />
                  <input
                    className="input"
                    value={ldapSettings.searchFilter}
                    onChange={(event) => updateLdapSettings("searchFilter", event.target.value)}
                    placeholder="(mail={{username}})"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="input"
                    value={ldapSettings.attrEmail}
                    onChange={(event) => updateLdapSettings("attrEmail", event.target.value)}
                    placeholder="mail"
                  />
                  <input
                    className="input"
                    value={ldapSettings.attrName}
                    onChange={(event) => updateLdapSettings("attrName", event.target.value)}
                    placeholder="cn"
                  />
                </div>
                <details className="rounded-xl border border-[var(--border)] bg-[var(--panel-muted)] p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-main">
                    {text(settings.language, "Gruppen- und Rollenmapping", "Group and role mapping")}
                  </summary>
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        className="input"
                        value={ldapSettings.groupSearchBase}
                        onChange={(event) => updateLdapSettings("groupSearchBase", event.target.value)}
                        placeholder="ou=groups,dc=example,dc=com"
                      />
                      <input
                        className="input"
                        value={ldapSettings.groupAttrMember}
                        onChange={(event) => updateLdapSettings("groupAttrMember", event.target.value)}
                        placeholder="member"
                      />
                    </div>
                    <input
                      className="input"
                      value={ldapSettings.groupMapAdmin}
                      onChange={(event) => updateLdapSettings("groupMapAdmin", event.target.value)}
                      placeholder="Admin Gruppen-DNs, kommasepariert"
                    />
                    <input
                      className="input"
                      value={ldapSettings.groupMapEditor}
                      onChange={(event) => updateLdapSettings("groupMapEditor", event.target.value)}
                      placeholder="Editor Gruppen-DNs, kommasepariert"
                    />
                    <input
                      className="input"
                      value={ldapSettings.groupMapUploader}
                      onChange={(event) => updateLdapSettings("groupMapUploader", event.target.value)}
                      placeholder="Uploader Gruppen-DNs, kommasepariert"
                    />
                  </div>
                </details>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={ldapSaving} className="btn btn-primary">
                    {ldapSaving
                      ? text(settings.language, "Speichert...", "Saving...")
                      : text(settings.language, "LDAP speichern", "Save LDAP")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void testLdap()}
                    disabled={ldapTesting}
                    className="btn btn-ghost"
                  >
                    {ldapTesting
                      ? text(settings.language, "Teste...", "Testing...")
                      : text(settings.language, "Verbindung testen", "Test connection")}
                  </button>
                </div>
              </form>
              {ldapTestResult ? (
                <div
                  className="mt-4 rounded-xl p-4"
                  style={{
                    background: ldapTestResult.ok
                      ? "color-mix(in srgb, var(--success, #22c55e) 10%, transparent)"
                      : "color-mix(in srgb, var(--error, #ef4444) 10%, transparent)",
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: ldapTestResult.ok ? "var(--success, #22c55e)" : "var(--error, #ef4444)" }}>
                    {ldapTestResult.ok
                      ? text(settings.language, "Verbindung erfolgreich", "Connection successful")
                      : text(settings.language, "Verbindung fehlgeschlagen", "Connection failed")}
                  </p>
                  <p className="mt-1 text-sm text-muted">{ldapTestResult.message}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="panel panel-padded">
          <div className="flex items-center justify-between gap-3">
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
              {text(settings.language, "Benutzer", "Users")}
            </h2>
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="btn-ghost px-4 py-2 text-sm font-semibold"
            >
              {text(settings.language, "Aktualisieren", "Refresh")}
            </button>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-muted">
              {text(settings.language, "Lade Benutzer...", "Loading users...")}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {users.map((user) => (
                <div key={user.membershipId} className="subgrid-card">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-main">{user.name}</p>
                        {user.authProvider === "ldap" ? (
                          <span className="badge-tech px-2 py-0.5 text-xs font-semibold">LDAP</span>
                        ) : (
                          <span style={{ background: "var(--panel-muted)", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: 600, color: "var(--text-soft)" }}>Lokal</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">{user.email}</p>
                      {user.ldapDn ? (
                        <p className="mt-1 text-xs text-soft truncate max-w-xs" title={user.ldapDn}>{user.ldapDn}</p>
                      ) : null}
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-soft">
                        {twoFactorLabel(user)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setError("");
                        try {
                          const response = await fetch(`/api/users/${user.userId}`, {
                            method: "DELETE",
                          });
                          const payload = (await response.json()) as { error?: string };
                          if (!response.ok) {
                            throw new Error(payload.error || "Benutzer konnte nicht entfernt werden.");
                          }
                          toast(text(settings.language, "Benutzer entfernt.", "User removed."), "success");
                          await loadUsers();
                        } catch (nextError) {
                          setError(
                            nextError instanceof Error
                              ? nextError.message
                              : "Benutzer konnte nicht entfernt werden.",
                          );
                        }
                      }}
                      className="btn-ghost px-3 py-2 text-xs font-semibold text-red-300"
                    >
                      {text(settings.language, "Entfernen", "Remove")}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                    <select
                      className="input"
                      value={user.role}
                      onChange={async (event) => {
                        const nextRole = event.target.value as TeamUser["role"];
                        setError("");
                        try {
                          const response = await fetch(`/api/users/${user.userId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              role: nextRole,
                              canUpload: user.canUpload,
                              readOnly: user.readOnly,
                            }),
                          });
                          const payload = (await response.json()) as { error?: string };
                          if (!response.ok) {
                            throw new Error(payload.error || "Benutzer konnte nicht aktualisiert werden.");
                          }
                          setUsers((current) =>
                            current.map((entry) =>
                              entry.userId === user.userId ? { ...entry, role: nextRole } : entry,
                            ),
                          );
                          toast(text(settings.language, "Rolle aktualisiert.", "Role updated."), "success");
                        } catch (nextError) {
                          setError(
                            nextError instanceof Error
                              ? nextError.message
                              : "Benutzer konnte nicht aktualisiert werden.",
                          );
                        }
                      }}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="EDITOR">Editor</option>
                      <option value="UPLOADER">Uploader</option>
                      <option value="READER">Reader</option>
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--panel-muted)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={user.canUpload}
                        onChange={async (event) => {
                          const nextValue = event.target.checked;
                          try {
                            const response = await fetch(`/api/users/${user.userId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                role: user.role,
                                canUpload: nextValue,
                                readOnly: user.readOnly,
                              }),
                            });
                            const payload = (await response.json()) as { error?: string };
                            if (!response.ok) {
                              throw new Error(payload.error || "Upload-Recht konnte nicht gespeichert werden.");
                            }
                            setUsers((current) =>
                              current.map((entry) =>
                                entry.userId === user.userId ? { ...entry, canUpload: nextValue } : entry,
                              ),
                            );
                            toast(
                              text(settings.language, "Upload-Recht aktualisiert.", "Upload permission updated."),
                              "success",
                            );
                          } catch (nextError) {
                            setError(
                              nextError instanceof Error
                                ? nextError.message
                                : "Upload-Recht konnte nicht gespeichert werden.",
                            );
                          }
                        }}
                      />
                      Upload
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--panel-muted)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontWeight: 600, color: "var(--text-main)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={user.readOnly}
                        onChange={async (event) => {
                          const nextValue = event.target.checked;
                          try {
                            const response = await fetch(`/api/users/${user.userId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                role: user.role,
                                canUpload: user.canUpload,
                                readOnly: nextValue,
                              }),
                            });
                            const payload = (await response.json()) as { error?: string };
                            if (!response.ok) {
                              throw new Error(payload.error || "Read-only konnte nicht gespeichert werden.");
                            }
                            setUsers((current) =>
                              current.map((entry) =>
                                entry.userId === user.userId ? { ...entry, readOnly: nextValue } : entry,
                              ),
                            );
                            toast(
                              text(settings.language, "Read-only aktualisiert.", "Read-only updated."),
                              "success",
                            );
                          } catch (nextError) {
                            setError(
                              nextError instanceof Error
                                ? nextError.message
                                : "Read-only konnte nicht gespeichert werden.",
                            );
                          }
                        }}
                      />
                      {text(settings.language, "Nur lesen", "Read only")}
                    </label>
                    <span className="badge-tech px-3 py-3 text-center text-xs font-semibold">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>

                  {user.authProvider !== "ldap" && (
                  <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 md:grid-cols-[1fr_auto_auto]">
                    <input
                      className="input"
                      type="password"
                      value={passwordDrafts[user.userId] ?? ""}
                      onChange={(event) =>
                        setPasswordDrafts((current) => ({
                          ...current,
                          [user.userId]: event.target.value,
                        }))
                      }
                      placeholder={text(
                        settings.language,
                        "Temporäres Passwort (mind. 8 Zeichen)",
                        "Temporary password (min. 8 chars)",
                      )}
                    />
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2 text-xs font-semibold"
                      onClick={async () => {
                        const nextPassword = passwordDrafts[user.userId] ?? "";
                        if (nextPassword.length < 8) {
                          setError(
                            text(
                              settings.language,
                              "Bitte ein Passwort mit mindestens 8 Zeichen setzen.",
                              "Please enter a password with at least 8 characters.",
                            ),
                          );
                          return;
                        }

                        try {
                          const response = await fetch(`/api/users/${user.userId}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "set-password",
                              password: nextPassword,
                            }),
                          });
                          const payload = (await response.json()) as { error?: string };
                          if (!response.ok) {
                            throw new Error(payload.error || "Passwort konnte nicht gesetzt werden.");
                          }
                          setPasswordDrafts((current) => ({
                            ...current,
                            [user.userId]: "",
                          }));
                          toast(
                            text(
                              settings.language,
                              "Temporäres Passwort gesetzt.",
                              "Temporary password set.",
                            ),
                            "success",
                          );
                        } catch (nextError) {
                          setError(
                            nextError instanceof Error
                              ? nextError.message
                              : "Passwort konnte nicht gesetzt werden.",
                          );
                        }
                      }}
                    >
                      {text(settings.language, "Passwort setzen", "Set password")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/users/${user.userId}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "reset-2fa",
                            }),
                          });
                          const payload = (await response.json()) as { error?: string };
                          if (!response.ok) {
                            throw new Error(payload.error || "2FA konnte nicht zurückgesetzt werden.");
                          }
                          toast(text(settings.language, "2FA zurückgesetzt.", "2FA reset."), "success");
                          await loadUsers();
                        } catch (nextError) {
                          setError(
                            nextError instanceof Error
                              ? nextError.message
                              : "2FA konnte nicht zurückgesetzt werden.",
                          );
                        }
                      }}
                    >
                      {text(settings.language, "2FA zurücksetzen", "Reset 2FA")}
                    </button>
                  </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
                {text(settings.language, "Einladungen", "Invitations")}
              </h3>
              <span className="badge-tech px-3 py-1 text-xs font-semibold">{invites.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {invites.length === 0 ? (
                <p className="text-sm text-muted">
                  {text(settings.language, "Noch keine Einladungen vorhanden.", "No invitations yet.")}
                </p>
              ) : (
                invites.map((invite) => {
                  const inviteLink =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/invite/${invite.token}`
                      : `/invite/${invite.token}`;

                  return (
                    <div key={invite.id} className="subgrid-card">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-main">{invite.email}</p>
                          <p className="mt-1 text-sm text-muted">
                            {roleLabel(invite.role)} •{" "}
                            {invite.acceptedAt
                              ? text(settings.language, "angenommen", "accepted")
                              : text(settings.language, "ausstehend", "pending")}
                          </p>
                          {invite.invitedByName ? (
                            <p className="mt-1 text-xs text-soft">
                              {text(settings.language, "Eingeladen von", "Invited by")}: {invite.invitedByName}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-soft">
                            {text(settings.language, "Gültig bis", "Valid until")}:{" "}
                            {formatDateTime(invite.expiresAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            const copied = await copyInviteLink(inviteLink);
                            toast(
                              copied
                                ? text(settings.language, "Einladungslink kopiert.", "Invitation link copied.")
                                : text(
                                    settings.language,
                                    "Link konnte nicht automatisch kopiert werden. Bitte manuell kopieren.",
                                    "The link could not be copied automatically. Please copy it manually.",
                                  ),
                              "success",
                            );
                          }}
                        >
                          {text(settings.language, "Link kopieren", "Copy link")}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!invite.acceptedAt ? (
                          <button
                            type="button"
                            className="btn-ghost px-3 py-2 text-xs font-semibold text-red-300"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/invitations/${invite.id}`, {
                                  method: "DELETE",
                                });
                                const payload = (await response.json()) as { error?: string };
                                if (!response.ok) {
                                  throw new Error(payload.error || "Einladung konnte nicht zurückgezogen werden.");
                                }
                                toast(
                                  text(settings.language, "Einladung zurückgezogen.", "Invitation revoked."),
                                  "success",
                                );
                                await loadUsers();
                              } catch (nextError) {
                                setError(
                                  nextError instanceof Error
                                    ? nextError.message
                                    : "Einladung konnte nicht zurückgezogen werden.",
                                );
                              }
                            }}
                          >
                            {text(settings.language, "Einladung zurückziehen", "Revoke invitation")}
                          </button>
                        ) : null}
                        <span className="badge-tech px-3 py-2 text-xs font-semibold">
                          {invite.acceptedAt
                            ? text(settings.language, "Angenommen", "Accepted")
                            : text(settings.language, "Ausstehend", "Pending")}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-[var(--border)] pt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
                {text(settings.language, "Aktivität", "Activity")}
              </h3>
              <span className="badge-tech px-3 py-1 text-xs font-semibold">{auditLogs.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted">
                  {text(
                    settings.language,
                    "Noch keine Aktivitäten vorhanden.",
                    "No activity entries yet.",
                  )}
                </p>
              ) : (
                auditLogs.map((entry) => (
                  <div key={entry.id} className="subgrid-card">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-main">
                          {entry.message ||
                            `${entry.entityType}: ${entry.action}`}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {entry.userName
                            ? `${entry.userName}${entry.userEmail ? ` (${entry.userEmail})` : ""}`
                            : text(settings.language, "System", "System")}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-soft">
                          {entry.entityType} • {entry.action}
                        </p>
                      </div>
                      <span className="badge-tech px-3 py-2 text-xs font-semibold">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error ? <p className="mt-6 text-sm text-red-200">{error}</p> : null}
        </section>
      </section>
    </div>
  );
}
