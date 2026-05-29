import type { Metadata } from "next";

import { AppShell } from "@/src/components/layout/app-shell";
import { MakershelfProvider } from "@/src/components/providers/makershelf-provider";
import { ToastProvider } from "@/src/components/ui/toast";
import { getRuntimeConfig } from "@/src/lib/runtime-config";
import "./globals.css";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const runtimeConfig = getRuntimeConfig();

  return {
    title: runtimeConfig.appName,
    description:
      "Server for 3D print project management with users, invitations and roles.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimeConfig = getRuntimeConfig();
  const publicRuntimeConfig = {
    MAKERSHELF_APP_NAME: runtimeConfig.appName,
    MAKERSHELF_DATA_BACKEND: runtimeConfig.dataBackend,
    MAKERSHELF_STORAGE_DRIVER: runtimeConfig.storageDriver,
    MAKERSHELF_PAGE_SIZE: String(runtimeConfig.pageSize),
    MAKERSHELF_DASHBOARD_FEATURED_COUNT: String(runtimeConfig.dashboardFeaturedCount),
    MAKERSHELF_MAX_PREVIEW_FILE_SIZE_MB: String(runtimeConfig.maxPreviewFileSizeMb),
    MAKERSHELF_ENABLE_EXPERIMENTAL_WEBSITE_IMPORT: runtimeConfig.enableExperimentalWebsiteImport ? "true" : "false",
    MAKERSHELF_DEMO_MODE: runtimeConfig.demoMode ? "true" : "false",
  };
  const themeBootstrapScript = `
    (function () {
      try {
        var raw = window.localStorage.getItem("makershelf-state");
        var parsed = raw ? JSON.parse(raw) : null;
        var settings = parsed && parsed.settings ? parsed.settings : null;
        var themeMode = settings && settings.themeMode ? settings.themeMode : "system";
        var primary = settings && settings.primaryColor ? settings.primaryColor : "#f97316";
        var secondary = settings && settings.secondaryColor ? settings.secondaryColor : "#1e293b";
        var resolvedTheme = themeMode === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : themeMode;

        document.documentElement.dataset.theme = resolvedTheme;
        document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
        document.documentElement.style.setProperty("--primary", primary);
        document.documentElement.style.setProperty("--secondary", secondary);
        document.documentElement.style.setProperty("--primary-soft", primary + "18");
        document.documentElement.style.setProperty("--secondary-soft", secondary + "18");
      } catch (error) {
        var fallbackTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.dataset.theme = fallbackTheme;
        document.documentElement.classList.toggle("dark", fallbackTheme === "dark");
      }
    })();
  `;

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          id="makershelf-runtime"
          dangerouslySetInnerHTML={{
            __html: `window.__MAKERSHELF_RUNTIME__=${JSON.stringify(publicRuntimeConfig)};`,
          }}
        />
        <script
          id="makershelf-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className="min-h-full bg-[var(--app-bg)] text-main">
        <MakershelfProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </MakershelfProvider>
      </body>
    </html>
  );
}
