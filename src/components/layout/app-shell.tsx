"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { BackgroundJobsPanel } from "@/src/components/layout/background-jobs-panel";
import { BuyMeACoffeeButton } from "@/src/components/layout/buy-me-a-coffee-button";
import { DebugConsole } from "@/src/components/layout/debug-console";
import { Navigation } from "@/src/components/layout/navigation";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { isPublicShellRoute } from "@/src/lib/app-shell-route-core";
import { APP_EVENTS } from "@/src/lib/events";
import { text } from "@/src/lib/locale";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

type ShellSystemState = {
  loading: boolean;
  bootstrapRequired: boolean;
  authenticated: boolean;
  user?: {
    twoFactorEnabled?: boolean;
    forcePasswordChange?: boolean;
  } | null;
};

function AppBootSplash({ appName }: { appName: string }) {
  return (
    <div className="content-inner flex items-center justify-center" style={{ minHeight: "100vh" }}>
      <div style={{ display: "grid", placeItems: "center", gap: "18px", textAlign: "center" }}>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 28,
            display: "grid",
            placeItems: "center",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Image src="/makershelf-logo.svg" alt="makershelf" width={86} height={86} priority />
        </div>
        <div>
          <p style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-main)" }}>{appName || "makershelf"}</p>
          <p style={{ marginTop: 6, color: "var(--text-muted)", fontSize: "14px" }}>Workspace wird geladen...</p>
        </div>
        <div
          aria-hidden="true"
          style={{
            width: 180,
            height: 4,
            borderRadius: 999,
            overflow: "hidden",
            background: "var(--panel-muted)",
            position: "relative",
          }}
        >
          <span
            style={{
              display: "block",
              width: "42%",
              height: "100%",
              borderRadius: 999,
              background: "var(--primary)",
              animation: "makershelf-progress 1.1s ease-in-out infinite alternate",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, settings } = useMakershelf();
  const demoMode = getRuntimeConfig().demoMode;
  const [systemState, setSystemState] = useState<ShellSystemState>({
    loading: true,
    bootstrapRequired: false,
    authenticated: false,
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function loadSystemState() {
      try {
        const [systemResponse, authResponse] = await Promise.all([
          fetch("/api/system/status", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" }),
        ]);
        const systemPayload = (await systemResponse.json()) as {
          bootstrapRequired?: boolean;
        };
        const authPayload = (await authResponse.json()) as {
          authenticated?: boolean;
          bootstrapRequired?: boolean;
          user?: {
            twoFactorEnabled?: boolean;
            forcePasswordChange?: boolean;
          } | null;
        };
        if (cancelled) return;
        setSystemState({
          loading: false,
          bootstrapRequired: Boolean(authPayload.bootstrapRequired ?? systemPayload.bootstrapRequired),
          authenticated: Boolean(authPayload.authenticated),
          user: authPayload.user ?? null,
        });
      } catch {
        if (cancelled) return;
        setSystemState({
          loading: false,
          bootstrapRequired: false,
          authenticated: false,
          user: null,
        });
      }
    }

    const handleAuthUpdated = () => {
      void loadSystemState();
    };

    void loadSystemState();
    window.addEventListener(APP_EVENTS.AUTH_UPDATED, handleAuthUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_EVENTS.AUTH_UPDATED, handleAuthUpdated);
    };
  }, [pathname, ready]);

  const isPublicRoute = isPublicShellRoute(pathname);

  const showSetupGate =
    !systemState.loading &&
    systemState.bootstrapRequired &&
    !isPublicRoute;

  const showLoginGate =
    !systemState.loading &&
    !systemState.bootstrapRequired &&
    !systemState.authenticated &&
    !isPublicRoute;

  const showSecurityGate =
    !systemState.loading &&
    systemState.authenticated &&
    !systemState.bootstrapRequired &&
    pathname !== "/user" &&
    !isPublicRoute &&
    !demoMode &&
    (Boolean(systemState.user?.forcePasswordChange) || !systemState.user?.twoFactorEnabled);

  const isSecuritySetupPage =
    pathname === "/user" &&
    systemState.authenticated &&
    !demoMode &&
    (Boolean(systemState.user?.forcePasswordChange) || !systemState.user?.twoFactorEnabled);
  const isSetupPage = isPublicRoute || isSecuritySetupPage;
  const showNavigation =
    ready &&
    !systemState.loading &&
    !isSetupPage &&
    !showSetupGate &&
    !showLoginGate &&
    !showSecurityGate;

  return (
    <div className="app-layout">
      {showNavigation ? <Navigation /> : null}

      <div className={showNavigation ? "app-content" : "w-full min-h-screen flex flex-col"}>
        {!ready || systemState.loading ? (
          <AppBootSplash appName={settings.appName} />
        ) : showSetupGate ? (
          <div className="content-inner flex items-center justify-center" style={{ minHeight: "80vh" }}>
            <div className="panel panel-padded" style={{ maxWidth: 520 }}>
              <div className="stat-card-icon" style={{ background: "var(--primary-soft)", color: "var(--primary)", marginBottom: "1rem" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="page-title" style={{ marginBottom: "8px" }}>
                {text(settings.language, "Server-Einrichtung", "Server setup required")}
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                {text(settings.language, "Bitte richte Workspace, Administrator und Sicherheit ein, bevor sich Benutzer anmelden können.", "Please set up workspace, admin account and security settings before users can sign in.")}
              </p>
              <Link href="/setup" className="btn btn-primary">
                {text(settings.language, "Server einrichten", "Set up server")}
              </Link>
            </div>
          </div>
        ) : showLoginGate ? (
          <div className="content-inner flex items-center justify-center" style={{ minHeight: "80vh" }}>
            <div className="panel panel-padded" style={{ maxWidth: 420 }}>
              <h1 className="page-title" style={{ marginBottom: "8px" }}>
                {text(settings.language, "Anmeldung erforderlich", "Sign in required")}
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                {text(settings.language, "Bitte melde dich an, um fortzufahren.", "Please sign in to continue.")}
              </p>
              <Link href="/login" className="btn btn-primary">
                {text(settings.language, "Zum Login", "Sign in")}
              </Link>
            </div>
          </div>
        ) : showSecurityGate ? (
          <div className="content-inner flex items-center justify-center" style={{ minHeight: "80vh" }}>
            <div className="panel panel-padded" style={{ maxWidth: 520 }}>
              <h1 className="page-title" style={{ marginBottom: "8px" }}>
                {text(settings.language, "Sicherheits-Setup erforderlich", "Security setup required")}
              </h1>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                {systemState.user?.forcePasswordChange
                  ? text(settings.language, "Bitte lege zuerst dein persönliches Passwort fest und aktiviere danach 2FA.", "Please set your personal password first and then enable 2FA.")
                  : text(settings.language, "Bitte aktiviere 2FA, bevor du die App nutzt.", "Please enable 2FA before using the app.")}
              </p>
              <Link href="/user" className="btn btn-primary">
                {text(settings.language, "Sicherheits-Setup öffnen", "Open security setup")}
              </Link>
            </div>
          </div>
        ) : (
          <div className={showNavigation ? "content-inner" : "flex-1"}>
            {children}
          </div>
        )}
      </div>

      <DebugConsole />
      {showNavigation ? <BackgroundJobsPanel /> : null}
      <BuyMeACoffeeButton />
    </div>
  );
}
