"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

type LoginScreenProps = {
  appName?: string;
};

type RecoveryUser = {
  email: string;
  name: string;
  role: string;
  twoFactorEnabled: boolean;
};

export function LoginScreen({ appName: appNameProp }: LoginScreenProps) {
  const { settings } = useMakershelf();
  const appName = appNameProp ?? settings.appName ?? "makershelf";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [recoveryUsers, setRecoveryUsers] = useState<RecoveryUser[]>([]);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [allowRecovery, setAllowRecovery] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setAllowRecovery(["localhost", "127.0.0.1"].includes(window.location.hostname));
  }, []);

  useEffect(() => {
    if (!allowRecovery) {
      return;
    }

    let active = true;

    async function loadRecovery() {
      try {
        const response = await fetch("/api/system/recovery");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          recoveryAvailable?: boolean;
          users?: RecoveryUser[];
        };
        if (!active) {
          return;
        }
        setRecoveryAvailable(Boolean(payload.recoveryAvailable));
        setRecoveryUsers(payload.users ?? []);
      } catch {
        // Recovery is optional and local-only.
      }
    }

    void loadRecovery();
    return () => {
      active = false;
    };
  }, [allowRecovery]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          token: token || undefined,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        requiresTwoFactor?: boolean;
      };

      if (!response.ok || !payload.ok) {
        const needs2FA = Boolean(payload.requiresTwoFactor);
        setRequiresTwoFactor(needs2FA);
        if (!needs2FA) {
          setError(
            payload.error ||
              text(settings.language, "Anmeldung fehlgeschlagen.", "Sign-in failed."),
          );
        }
        setPending(false);
        return;
      }

      let authenticated = false;

      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          const sessionResponse = await fetch("/api/auth/session", {
            cache: "no-store",
            credentials: "same-origin",
          });
          const sessionPayload = (await sessionResponse.json()) as {
            authenticated?: boolean;
          };

          if (sessionPayload.authenticated) {
            authenticated = true;
            break;
          }
        } catch {
          // Ignore and retry briefly before redirecting.
        }

        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }

      if (authenticated) {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }

      window.location.assign("/");
    } catch {
      setError(text(settings.language, "Verbindungsfehler. Bitte versuche es erneut.", "Connection error. Please try again."));
      setPending(false);
    }
  }

  async function handleRecovery(targetEmail?: string) {
    setRecoveryPending(true);
    setRecoveryStatus("");
    setError("");

    try {
      const response = await fetch("/api/system/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        email?: string;
        temporaryPassword?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error ||
            text(settings.language, "Wiederherstellung fehlgeschlagen.", "Recovery failed."),
        );
      }

      setEmail(payload.email ?? targetEmail ?? "");
      setPassword(payload.temporaryPassword ?? "ChangeMe123!");
      setToken("");
      setRequiresTwoFactor(false);
      setRecoveryStatus(
        payload.message
          ? `${payload.message} Login: ${payload.email} / ${payload.temporaryPassword}`
          : `${text(settings.language, "Zugang bereit.", "Access ready.")} ${payload.email} / ${payload.temporaryPassword}`,
      );
    } catch (nextError) {
      setRecoveryStatus(
        nextError instanceof Error
          ? nextError.message
          : text(settings.language, "Wiederherstellung fehlgeschlagen.", "Recovery failed."),
      );
    } finally {
      setRecoveryPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <section className="panel-technical w-full p-8">
        <p className="hero-kicker">
          {text(settings.language, "Anmeldung", "Sign in")}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-main">
          {text(settings.language, `Bei ${appName} anmelden`, `Sign in to ${appName}`)}
        </h1>
        <p className="mt-4 text-muted">
          {text(
            settings.language,
            "Melde dich mit deinem Benutzerkonto an. Wenn 2FA aktiv ist, gib danach den Code aus deiner Authenticator-App ein.",
            "Sign in with your user account. If 2FA is active, enter the code from your authenticator app afterwards.",
          )}
        </p>

        <div className="surface-subtle mt-6 rounded-2xl p-4 text-sm text-muted">
          <p className="font-semibold text-main">
            {text(settings.language, "Noch kein Zugang?", "No access yet?")}
          </p>
          <p className="mt-2">
            {text(
              settings.language,
              "Wenn du per Einladung eingeladen wurdest, öffne zuerst deinen Einladungslink und schließe dort dein Konto ab.",
              "If you were invited, open your invitation link first and finish creating your account there.",
            )}
          </p>
          <p className="mt-2">
            {text(
              settings.language,
              "Wenn dies die erste Einrichtung ist, öffne zuerst das Setup und lege Workspace sowie ersten Administrator an.",
              "If this is the first setup, open setup first and create the workspace plus the first administrator.",
            )}
          </p>
        </div>

        {allowRecovery && recoveryAvailable ? (
          <div className="surface-subtle mt-4 rounded-2xl border border-amber-300/20 p-4 text-sm text-muted">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-main">
                  {text(settings.language, "Kontozugang wiederherstellen", "Recover account access")}
                </p>
                <p className="mt-2">
                  {text(
                    settings.language,
                    "Hier kannst du einen temporären Zugang anfordern, wenn du lokal den Zugriff verloren hast.",
                    "Request temporary access here if you lost access on this local installation.",
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleRecovery(email || undefined)}
                className="btn btn-ghost btn-sm"
                disabled={recoveryPending}
              >
                {recoveryPending
                  ? text(settings.language, "Wiederherstellung läuft...", "Recovery in progress...")
                  : text(settings.language, "Temporären Zugang erzeugen", "Create temporary access")}
              </button>
            </div>
            {recoveryUsers.length ? (
              <div className="mt-4 space-y-2">
                {recoveryUsers.map((user) => (
                  <button
                    key={user.email}
                    type="button"
                    onClick={() => void handleRecovery(user.email)}
                    className="surface-subtle flex w-full items-center justify-between rounded-xl px-3 py-3 text-left"
                    disabled={recoveryPending}
                  >
                    <span>
                      <span className="block font-semibold text-main">{user.name}</span>
                      <span className="block text-xs text-muted">{user.email}</span>
                    </span>
                    <span className="text-xs font-semibold text-soft">{user.role}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {recoveryStatus ? (
              <p className="mt-3 text-sm text-amber-100">{recoveryStatus}</p>
            ) : null}
          </div>
        ) : null}

        {requiresTwoFactor ? (
          <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
            <div style={{ background: "var(--primary-soft)", borderRadius: "12px", padding: "14px 16px", marginBottom: "4px" }}>
              <p className="text-sm font-semibold text-main" style={{ marginBottom: "4px" }}>
                {text(settings.language, "Zwei-Faktor-Authentifizierung", "Two-factor authentication")}
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                {text(
                  settings.language,
                  `Angemeldet als ${email}. Bitte gib jetzt den Code aus deiner Authenticator-App ein.`,
                  `Signed in as ${email}. Please enter the code from your authenticator app.`,
                )}
              </p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-main">
                {text(settings.language, "Authenticator-Code", "Authenticator code")}
              </span>
              <input
                className="input"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                required
              />
            </label>

            {error ? (
              <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: "10px", padding: "12px 16px", fontSize: "13.5px", color: "var(--danger)", fontWeight: 500 }}>
                {error}
              </div>
            ) : null}

            <button className="btn btn-primary mt-2 px-5 py-3 text-sm font-semibold" disabled={pending}>
              {pending
                ? text(settings.language, "Prüfe Code...", "Verifying code...")
                : text(settings.language, "Code bestätigen", "Confirm code")}
            </button>

            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => { setRequiresTwoFactor(false); setToken(""); setError(""); }}
            >
              {text(settings.language, "← Zurück zur Anmeldung", "← Back to sign in")}
            </button>
          </form>
        ) : (
          <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-main">
                {text(settings.language, "E-Mail", "Email")}
              </span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-main">
                {text(settings.language, "Passwort", "Password")}
              </span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error ? (
              <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: "10px", padding: "12px 16px", fontSize: "13.5px", color: "var(--danger)", fontWeight: 500 }}>
                {error}
              </div>
            ) : null}

            <button className="btn btn-primary mt-2 px-5 py-3 text-sm font-semibold" disabled={pending}>
              {pending
                ? text(settings.language, "Anmeldung läuft...", "Signing in...")
                : text(settings.language, "Anmelden", "Sign in")}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/setup" className="btn btn-ghost">
            {text(settings.language, "Setup öffnen", "Open setup")}
          </Link>
          {process.env.NEXT_PUBLIC_APP_VERSION && (
            <span aria-hidden="true" style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.6, userSelect: "none" }}>
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
