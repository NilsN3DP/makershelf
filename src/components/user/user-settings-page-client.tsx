"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { APP_EVENTS, dispatchAppEvent } from "@/src/lib/events";
import { text } from "@/src/lib/locale";

const BRIDGE_KEY = "makershelf-bridge-installed-v2";
const LEGACY_BRIDGE_KEY = "makershelf-bridge-installed";

type SessionPayload = {
  authenticated: boolean;
  workspace?: { name: string } | null;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    locale?: string | null;
    twoFactorEnabled?: boolean;
    forcePasswordChange?: boolean;
  };
};

function downloadBackupCodesFile(codes: string[], email?: string) {
  if (!codes.length) {
    return;
  }

  const content = [
    "makershelf Backup Codes",
    email ? `Account: ${email}` : "",
    `Generated: ${new Date().toLocaleString("de-DE")}`,
    "",
    ...codes,
    "",
    "Store these codes in a safe place.",
  ]
    .filter(Boolean)
    .join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `makershelf-backup-codes${email ? `-${email.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` : ""}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function UserSettingsPageClient() {
  const { settings, updateSettings } = useMakershelf();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileLocale, setProfileLocale] = useState<"de" | "en">("de");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [twoFactorUrl, setTwoFactorUrl] = useState("");
  const [twoFactorQrCode, setTwoFactorQrCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState("");

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as SessionPayload;
      setSession(payload);
      setProfileName(payload.user?.name ?? "");
      setProfileLocale((payload.user?.locale as "de" | "en") ?? settings.language);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Benutzerdaten konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [settings.language]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    let active = true;

    async function buildQrCode() {
      if (!twoFactorUrl) {
        setTwoFactorQrCode("");
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(twoFactorUrl, {
          width: 280,
          margin: 1,
          color: {
            dark: "#0b1324",
            light: "#0000",
          },
        });

        if (active) {
          setTwoFactorQrCode(dataUrl);
        }
      } catch {
        if (active) {
          setTwoFactorQrCode("");
        }
      }
    }

    void buildQrCode();

    return () => {
      active = false;
    };
  }, [twoFactorUrl]);

  if (loading) {
    return (
      <div className="panel panel-padded">
        <p className="text-sm text-muted">
          {text(settings.language, "Lade Benutzerprofil...", "Loading user profile...")}
        </p>
      </div>
    );
  }

  if (!session?.authenticated || !session.user) {
    return (
      <div className="panel panel-padded">
        <h1 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
          {text(settings.language, "Benutzerprofil", "User profile")}
        </h1>
        <p className="mt-3 text-muted">
          {text(
            settings.language,
            "Bitte richte die Installation zuerst ein oder melde dich mit deinem Benutzerkonto an.",
            "Please finish setup first or sign in with your user account.",
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/setup" className="btn btn-ghost">
            {text(settings.language, "Setup öffnen", "Open setup")}
          </a>
          <a href="/login" className="btn btn-primary">
            Login
          </a>
        </div>
      </div>
    );
  }

  const requiresPasswordChange = Boolean(session.user.forcePasswordChange);
  const requiresTwoFactor = !session.user.twoFactorEnabled;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{profileName}</h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              "Persönliches Profil, Passwort und 2FA werden hier für deinen Account verwaltet.",
              "Manage your personal profile, password and 2FA for your account here.",
            )}
          </p>
        </div>
      </div>

      {(requiresPasswordChange || requiresTwoFactor) && (
        <section className="panel panel-padded" style={{ marginBottom: "1.25rem", borderLeft: "3px solid var(--primary)" }}>
          <h2 className="panel-title">
            {text(settings.language, "Pflichtschritt vor der Nutzung", "Required step before use")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {requiresPasswordChange && requiresTwoFactor
              ? text(settings.language, "Bitte ändere zuerst dein Startpasswort und aktiviere anschließend 2FA per QR-Code.", "Please change your starter password first and then enable 2FA with the QR code.")
              : requiresPasswordChange
                ? text(settings.language, "Bitte ändere dein Startpasswort, bevor du weiterarbeitest.", "Please change your starter password before continuing.")
                : text(settings.language, "Bitte aktiviere 2FA per QR-Code, bevor du weiterarbeitest.", "Please enable 2FA with the QR code before continuing.")}
          </p>
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}>
        <section className="panel panel-padded">
          <h2 className="panel-title">
            {text(settings.language, "Profil", "Profile")}
          </h2>
          <form
            className="mt-5 grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setStatus("");
              setError("");

              try {
                const response = await fetch("/api/auth/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: profileName,
                    locale: profileLocale,
                  }),
                });
                const payload = (await response.json()) as { ok?: boolean; error?: string };
                if (!response.ok || !payload.ok) {
                  throw new Error(payload.error || "Profil konnte nicht gespeichert werden.");
                }

                updateSettings({ userName: profileName, language: profileLocale });
                setStatus(
                  text(settings.language, "Profil gespeichert.", "Profile saved."),
                );
                await loadSession();
                dispatchAppEvent(APP_EVENTS.AUTH_UPDATED);
              } catch (nextError) {
                setError(
                  nextError instanceof Error
                    ? nextError.message
                    : "Profil konnte nicht gespeichert werden.",
                );
              }
            }}
          >
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-main">
                {text(settings.language, "Name", "Name")}
              </span>
              <input
                className="input"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-main">E-Mail</span>
              <input className="input" value={session.user.email} disabled />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-main">
                {text(settings.language, "Sprache", "Language")}
              </span>
              <select
                className="input"
                value={profileLocale}
                onChange={(event) => setProfileLocale(event.target.value as "de" | "en")}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <button className="btn btn-primary">
              {text(settings.language, "Profil speichern", "Save profile")}
            </button>
          </form>
        </section>

        <section className="panel panel-padded">
          <h2 className="panel-title">
            {text(settings.language, "Passwort", "Password")}
          </h2>
          <form
            className="mt-5 grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setStatus("");
              setError("");
              try {
                const response = await fetch("/api/auth/password", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    currentPassword,
                    newPassword,
                  }),
                });
                const payload = (await response.json()) as { ok?: boolean; error?: string };
                if (!response.ok || !payload.ok) {
                  throw new Error(payload.error || "Passwort konnte nicht geändert werden.");
                }
                setCurrentPassword("");
                setNewPassword("");
                setStatus(
                  text(settings.language, "Passwort aktualisiert.", "Password updated."),
                );
                await loadSession();
                dispatchAppEvent(APP_EVENTS.AUTH_UPDATED);
              } catch (nextError) {
                setError(
                  nextError instanceof Error
                    ? nextError.message
                    : "Passwort konnte nicht geändert werden.",
                );
              }
            }}
          >
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={text(settings.language, "Aktuelles Passwort", "Current password")}
            />
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={text(settings.language, "Neues Passwort", "New password")}
            />
            <button className="btn btn-primary">
              {text(settings.language, "Passwort speichern", "Save password")}
            </button>
          </form>
        </section>
      </section>

      <section className="panel panel-padded">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="panel-title">
              {text(settings.language, "Zwei-Faktor-Authentifizierung", "Two-factor authentication")}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {session.user.twoFactorEnabled
                ? text(settings.language, "2FA ist bereits aktiv.", "2FA is already active.")
                : text(
                    settings.language,
                    "Richte 2FA mit einer Authenticator-App ein.",
                    "Set up 2FA with an authenticator app.",
                  )}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              setStatus("");
              setError("");
              try {
                const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
                const payload = (await response.json()) as {
                  ok?: boolean;
                  error?: string;
                  otpauthUrl?: string;
                  backupCodes?: string[];
                };
                if (!response.ok || !payload.ok || !payload.otpauthUrl) {
                  throw new Error(payload.error || "2FA konnte nicht vorbereitet werden.");
                }
                setTwoFactorUrl(payload.otpauthUrl);
                setBackupCodes(payload.backupCodes ?? []);
                setStatus(
                  text(
                    settings.language,
                    "2FA-Setup erstellt. Bitte Code prüfen und bestätigen.",
                    "2FA setup created. Please verify the code.",
                  ),
                );
              } catch (nextError) {
                setError(
                  nextError instanceof Error
                    ? nextError.message
                    : "2FA konnte nicht vorbereitet werden.",
                );
              }
            }}
          >
            {text(settings.language, "2FA neu erzeugen", "Generate 2FA setup")}
          </button>
        </div>

        {twoFactorUrl ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr_0.8fr]">
            <div className="surface-subtle rounded-lg p-4">
              <p className="text-sm font-semibold text-main">
                {text(settings.language, "QR-Code", "QR code")}
              </p>
              <p className="mt-2 text-sm text-muted">
                {text(
                  settings.language,
                  "Mit Google Authenticator, 2FAS, Aegis, Authy oder Microsoft Authenticator scannen.",
                  "Scan with Google Authenticator, 2FAS, Aegis, Authy or Microsoft Authenticator.",
                )}
              </p>
              <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
                {twoFactorQrCode ? (
                  <Image
                    src={twoFactorQrCode}
                    alt="2FA QR code"
                    width={224}
                    height={224}
                    className="h-56 w-56 rounded-lg"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
                    QR wird erstellt...
                  </div>
                )}
              </div>
            </div>

            <div className="surface-subtle rounded-lg p-4">
              <p className="text-sm font-semibold text-main">
                {text(settings.language, "Authenticator-URL", "Authenticator URL")}
              </p>
              <p className="mt-2 break-all text-sm text-muted">{twoFactorUrl}</p>
              <button
                type="button"
                className="btn btn-ghost mt-4"
                onClick={async () => {
                  await navigator.clipboard.writeText(twoFactorUrl);
                  setStatus(
                    text(
                      settings.language,
                      "Authenticator-URL kopiert.",
                      "Authenticator URL copied.",
                    ),
                  );
                }}
              >
                {text(settings.language, "URL kopieren", "Copy URL")}
              </button>
              <input
                className="input mt-4"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={text(settings.language, "6-stelligen Code eingeben", "Enter 6-digit code")}
              />
              <button
                type="button"
                className="btn btn-primary mt-4"
                onClick={async () => {
                  setStatus("");
                  setError("");
                  try {
                    const response = await fetch("/api/auth/2fa/verify", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ token }),
                    });
                    const payload = (await response.json()) as { ok?: boolean; error?: string };
                    if (!response.ok || !payload.ok) {
                      throw new Error(payload.error || "2FA konnte nicht aktiviert werden.");
                    }
                    setToken("");
                    setStatus(text(settings.language, "2FA aktiviert.", "2FA enabled."));
                    await loadSession();
                    dispatchAppEvent(APP_EVENTS.AUTH_UPDATED);
                  } catch (nextError) {
                    setError(
                      nextError instanceof Error
                        ? nextError.message
                        : "2FA konnte nicht aktiviert werden.",
                    );
                  }
                }}
              >
                {text(settings.language, "2FA aktivieren", "Enable 2FA")}
              </button>
            </div>
            <div className="surface-subtle rounded-lg p-4">
              <p className="text-sm font-semibold text-main">
                {text(settings.language, "Backup-Codes", "Backup codes")}
              </p>
              <button
                type="button"
                className="btn btn-ghost mt-3"
                onClick={() => downloadBackupCodesFile(backupCodes, session.user?.email)}
                disabled={!backupCodes.length}
              >
                {text(settings.language, "Als Textdatei laden", "Download as text file")}
              </button>
              <div className="mt-3 grid gap-2">
                {backupCodes.length ? (
                  backupCodes.map((code) => (
                    <code key={code} className="rounded bg-black/20 px-3 py-2 text-sm text-main">
                      {code}
                    </code>
                  ))
                ) : (
                  <p className="text-sm text-muted">
                    {text(settings.language, "Noch keine Codes erstellt.", "No codes generated yet.")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        ) : null}
      </section>

      <section className="panel panel-padded">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="panel-title">
              makershelf Bridge
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {text(
                settings.language,
                "Installiere die lokale Bridge neu, wenn Windows den Slicer-Aufruf nicht mehr öffnet oder noch die alte MAKERSHELF-Registrierung aktiv ist.",
                "Reinstall the local Bridge if Windows no longer opens slicer links or still has the old MAKERSHELF registration active.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                localStorage.removeItem(BRIDGE_KEY);
                localStorage.removeItem(LEGACY_BRIDGE_KEY);
                setBridgeStatus(
                  text(
                    settings.language,
                    "Bridge-Einrichtung wird beim nächsten 'Im Slicer öffnen' wieder angezeigt.",
                    "Bridge setup will be shown again the next time you use 'Open in slicer'.",
                  ),
                );
              }}
            >
              {text(settings.language, "Einrichtung erneut anzeigen", "Show setup again")}
            </button>
            <a
              href="/api/system/makershelf-bridge"
              download="install-makershelf-bridge.ps1"
              className="btn btn-primary"
              onClick={() => {
                localStorage.removeItem(BRIDGE_KEY);
                localStorage.removeItem(LEGACY_BRIDGE_KEY);
                setBridgeStatus(
                  text(
                    settings.language,
                    "Bridge-Skript wurde heruntergeladen. Fuehre es per Rechtsklick mit PowerShell aus; danach ist makershelf:// aktiv.",
                    "Bridge script downloaded. Run it with PowerShell from the context menu; makershelf:// is active afterwards.",
                  ),
                );
              }}
            >
              {text(settings.language, "Bridge neu installieren", "Reinstall Bridge")}
            </a>
          </div>
        </div>
        {bridgeStatus ? (
          <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {bridgeStatus}
          </div>
        ) : null}
      </section>
    </div>
  );
}
