"use client";

import { useMemo } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

export function SpoolmanPageClient() {
  const { settings } = useMakershelf();
  const spoolmanUrl = "";
  const safeUrl = useMemo(() => {
    if (!spoolmanUrl) return "";
    try {
      const parsed = new URL(spoolmanUrl);
      return parsed.toString();
    } catch {
      return "";
    }
  }, [spoolmanUrl]);

  return (
    <div className="space-y-6">
      <section className="hero-card">
        <p className="eyebrow">Spoolman</p>
        <h1 className="page-title">Filamentverwaltung</h1>
        <p className="page-subtitle">
          {text(
            settings.language,
            "Optional verknüpfte Spoolman-Instanz für Spulen, Hersteller und Materialdaten.",
            "Optional linked Spoolman instance for spools, vendors and material data.",
          )}
        </p>
      </section>

      {!safeUrl ? (
        <section className="panel panel-padded">
          <h2 className="text-xl font-bold">{text(settings.language, "Spoolman ist nicht eingerichtet", "Spoolman is not configured")}</h2>
          <p className="mt-2 text-muted">
            {text(
              settings.language,
              "Aktiviere Spoolman in den Einstellungen unter Integrationen und hinterlege die URL deiner Instanz.",
              "Enable Spoolman in Settings under Integrations and enter your instance URL.",
            )}
          </p>
          <a className="btn btn-primary mt-4" href="/settings">
            {text(settings.language, "Zu den Einstellungen", "Open settings")}
          </a>
        </section>
      ) : (
        <section className="panel panel-padded">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Spoolman</h2>
              <p className="text-muted">{safeUrl}</p>
            </div>
            <a className="btn btn-primary" href={safeUrl} target="_blank" rel="noreferrer">
              {text(settings.language, "In neuem Tab öffnen", "Open in new tab")}
            </a>
          </div>
          <iframe
            title="Spoolman"
            src={safeUrl}
            className="w-full rounded-2xl border border-white/10 bg-black/20"
            style={{ minHeight: "72vh" }}
          />
        </section>
      )}
    </div>
  );
}
