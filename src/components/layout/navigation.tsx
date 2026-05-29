"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

type AuthState = {
  authenticated: boolean;
  permissions?: { canManageUsers?: boolean };
  workspace?: { name: string } | null;
  user?: { name: string; role: string };
};

// ─── Icons ────────────────────────────────────────────────────────────
function IconHome() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <polyline points="9 21 9 12 15 12 15 21" />
    </svg>
  );
}
function IconFolders() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a2 2 0 012-2h3.586a1 1 0 01.707.293L10 9h10a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V9z" />
    </svg>
  );
}
function IconList() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" />
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}
function IconScan() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconFilament() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="4" />
      <circle cx="8" cy="8" r="1.4" />
      <path d="M12 8h3.5A4.5 4.5 0 0120 12.5v0A4.5 4.5 0 0115.5 17H5" />
      <path d="M5 17c0 1.7 1.3 3 3 3h7" />
    </svg>
  );
}
function IconPrinterFarm() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="9" rx="1.5" />
      <path d="M6 8V5a1 1 0 011-1h10a1 1 0 011 1v3" />
      <circle cx="8" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.5" r="1" fill="currentColor" stroke="none" />
      <rect x="14" y="17" width="6" height="4" rx="0.5" />
    </svg>
  );
}
function IconTools3D() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4.5v9L12 20 4 15.5v-9L12 2z" />
      <path d="M12 2v18M4 6.5l8 4.5 8-4.5" />
    </svg>
  );
}
function IconLaser() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <path d="M9 15l3 3 3-3" />
      <path d="M5 11h4M15 11h4" />
      <path d="M7 19h10" />
    </svg>
  );
}
function IconPlotter() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="14" width="20" height="6" rx="1.5" />
      <path d="M6 14V6a1 1 0 011-1h10a1 1 0 011 1v8" />
      <line x1="7" y1="17" x2="10" y2="17" />
      <path d="M12 4v3M9 7h6" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useMakershelf();
  const demoMode = getRuntimeConfig().demoMode;
  const menuRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({
    authenticated: false,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
        const payload = (await response.json()) as AuthState;
        if (!cancelled) {
          setAuthState({
            authenticated: Boolean(payload.authenticated),
            permissions: payload.permissions,
            workspace: payload.workspace,
            user: payload.user,
          });
        }
      } catch {
        if (!cancelled) {
          setAuthState({ authenticated: false });
        }
      }
    }
    void loadSession();
    return () => { cancelled = true; };
  }, [pathname]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [userMenuOpen]);

  if (pathname === "/setup") {
    return null;
  }

  const navItems: { href: string; label: string; icon: React.ReactNode; section?: string }[] = [
    { href: "/", label: text(settings.language, "Übersicht", "Overview"), icon: <IconHome /> },
    { href: "/projects", label: text(settings.language, "Projekte", "Projects"), icon: <IconFolders /> },
    { href: "/favorites", label: text(settings.language, "Favoriten", "Favorites"), icon: <IconStar /> },
    { href: "/lists", label: text(settings.language, "Listen", "Lists"), icon: <IconList /> },
    { href: "/stats", label: text(settings.language, "Statistiken", "Stats"), icon: <IconBarChart /> },
  ];

  if (!demoMode) {
    navItems.push(
      { href: "/indexing", label: text(settings.language, "Indexierung", "Indexing"), icon: <IconScan />, section: "tools" },
      { href: "/duplicates", label: text(settings.language, "Duplikate", "Duplicates"), icon: <IconCopy />, section: "tools" },
    );
  }

  if (!demoMode && settings.filamentVaultEnabled) {
    navItems.push({
      href: "/filament",
      label: "Filament Vault",
      icon: <IconFilament />,
      section: "3dp",
    });
  }

  if (!demoMode && settings.printerFarmEnabled) {
    navItems.push({
      href: "/printer-farm",
      label: text(settings.language, "Drucker Farm", "Printer Farm"),
      icon: <IconPrinterFarm />,
      section: "3dp",
    });
  }

  if (!demoMode && settings.printToolsEnabled) {
    navItems.push({
      href: "/tools/3d",
      label: text(settings.language, "3D Tools", "3D Tools"),
      icon: <IconTools3D />,
      section: "3dp",
    });
  }

  if (!demoMode && settings.laserEnabled) {
    navItems.push({
      href: "/laser",
      label: text(settings.language, "Laser", "Laser"),
      icon: <IconLaser />,
      section: "maker",
    });
  }

  if (!demoMode && settings.plotterEnabled) {
    navItems.push({
      href: "/plotter",
      label: text(settings.language, "Plotter", "Plotter"),
      icon: <IconPlotter />,
      section: "maker",
    });
  }

  if (!demoMode && settings.multiUserEnabled && authState.permissions?.canManageUsers) {
    navItems.push({
      href: "/team",
      label: text(settings.language, "Benutzer", "Users"),
      icon: <IconUsers />,
      section: "tools",
    });
  }

  const mainItems = navItems.filter((i) => !i.section);
  const toolItems = navItems.filter((i) => i.section === "tools");
  const tdpItems = navItems.filter((i) => i.section === "3dp");
  const makerItems = navItems.filter((i) => i.section === "maker");
  const mobileItems = [
    { href: "/", label: text(settings.language, "Übersicht", "Overview"), icon: <IconHome /> },
    { href: "/projects", label: text(settings.language, "Projekte", "Projects"), icon: <IconFolders /> },
    { href: "/favorites", label: text(settings.language, "Favoriten", "Favorites"), icon: <IconStar /> },
    ...(!demoMode
      ? [{ href: "/indexing", label: text(settings.language, "Indexierung", "Indexing"), icon: <IconScan /> }]
      : []),
    { href: "/settings", label: text(settings.language, "Einstellungen", "Settings"), icon: <IconSettings /> },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function isMobileActive(href: string) {
    return isActive(href);
  }

  async function handleLogout() {
    setUserMenuOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const userInitial = (authState.user?.name || settings.userName || "U").slice(0, 1).toUpperCase();
  const userName = authState.user?.name || settings.userName || "User";
  const workspaceName =
    authState.workspace?.name && /open\s*printing\s*vault|makershelf/i.test(authState.workspace.name)
      ? "makershelf"
      : authState.workspace?.name;

  return (
    <aside className="app-sidebar">
      {/* Logo */}
      <Link href="/" className="sidebar-logo">
        <Image src="/makershelf-logo.svg" alt="makershelf" width={28} height={28} className="rounded-lg" />
        <span className="sidebar-logo-text">{settings.appName || "makershelf"}</span>
      </Link>

      {/* Main nav */}
      <div className="sidebar-section desktop-nav-section" style={{ paddingTop: "10px" }}>
        {mainItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${isActive(item.href) ? " active" : ""}`}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Tools section */}
      {toolItems.length > 0 && (
        <div className="sidebar-section desktop-nav-section">
          <span className="sidebar-section-label">
            {text(settings.language, "Werkzeuge", "Tools")}
          </span>
          {toolItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item.href) ? " active" : ""}`}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 3D-Druck section */}
      {tdpItems.length > 0 && (
        <div className="sidebar-section desktop-nav-section">
          <span className="sidebar-section-label">
            {text(settings.language, "3D-Druck", "3D Printing")}
          </span>
          {tdpItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item.href) ? " active" : ""}`}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Laser & Plotter section */}
      {makerItems.length > 0 && (
        <div className="sidebar-section desktop-nav-section">
          <span className="sidebar-section-label">
            {text(settings.language, "Laser & Plotter", "Laser & Plotter")}
          </span>
          {makerItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item.href) ? " active" : ""}`}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mobile-nav-section" aria-label={text(settings.language, "Mobile Navigation", "Mobile navigation")}>
        {mobileItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${isMobileActive(item.href) ? " active" : ""}`}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Bottom: settings + user */}
      <div className="sidebar-bottom desktop-sidebar-bottom">
        <Link
          href="/settings"
          className={`nav-link${isActive("/settings") ? " active" : ""}`}
        >
          <IconSettings />
          <span className="nav-label">{text(settings.language, "Einstellungen", "Settings")}</span>
        </Link>

        {process.env.NEXT_PUBLIC_APP_VERSION && (
          <div aria-hidden="true" style={{ padding: "4px 12px", textAlign: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.6, userSelect: "none" }}>
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          </div>
        )}

        {authState.authenticated ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="sidebar-user w-full"
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <div className="sidebar-avatar">{userInitial}</div>
              <span className="sidebar-user-name">{userName}</span>
              <IconChevron />
            </button>

            {userMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "8px",
                  right: "8px",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  boxShadow: "var(--shadow-lg)",
                  padding: "8px",
                  zIndex: 100,
                  marginBottom: "4px",
                }}
              >
                <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--border)", marginBottom: "6px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{userName}</p>
                  {workspaceName && (
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{workspaceName}</p>
                  )}
                </div>
                <Link href="/user" onClick={() => setUserMenuOpen(false)} className="nav-link" style={{ color: "var(--text-muted)", marginInline: 0, paddingInline: "10px" }}>
                  <span className="nav-label">{text(settings.language, "Benutzerprofil", "Profile")}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="nav-link w-full"
                  style={{ color: "var(--danger)", marginInline: 0, paddingInline: "10px", background: "none", border: "none", textAlign: "left", gap: "8px", cursor: "pointer" }}
                >
                  <IconLogout />
                  <span className="nav-label">{text(settings.language, "Abmelden", "Sign out")}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="nav-link" style={{ color: "var(--primary)" }}>
            <span className="nav-label">{text(settings.language, "Anmelden", "Sign in")}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
