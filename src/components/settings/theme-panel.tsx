"use client";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";
import {
  getThemePresetDescription,
  isActiveThemePreset,
  themePresets,
} from "@/src/lib/theme-presets";

export function ThemePanel() {
  const { settings, updateSettings } = useMakershelf();

  return (
    <section className="panel-technical p-6">
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] accent-text">
          {text(settings.language, "Design", "Design")}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-main">
          {text(settings.language, "Themes & Farben", "Themes & colors")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {text(
            settings.language,
            "Wähle einen kompletten Look oder passe die Farben manuell an.",
            "Choose a complete visual style or fine-tune the colors manually.",
          )}
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {themePresets.map((preset) => {
            const isActive = isActiveThemePreset(
              settings.primaryColor,
              settings.secondaryColor,
              preset,
            );

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  updateSettings({
                    primaryColor: preset.primaryColor,
                    secondaryColor: preset.secondaryColor,
                  })
                }
                className={`text-left panel rounded-2xl p-4 transition ${
                  isActive ? "border-[var(--primary)] shadow-[var(--shadow-strong)]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-main">{preset.name}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {getThemePresetDescription(settings.language, preset)}
                    </p>
                  </div>
                  {isActive ? (
                    <span className="badge-tech px-3 py-1 text-xs font-semibold">
                      {text(settings.language, "Aktiv", "Active")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className="h-10 w-10 rounded-xl border border-black/10"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <span
                    className="h-10 w-10 rounded-xl border border-black/10"
                    style={{ backgroundColor: preset.secondaryColor }}
                  />
                  <div className="text-xs text-muted">
                    <div>{preset.primaryColor}</div>
                    <div>{preset.secondaryColor}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="panel rounded-2xl p-4">
            <span className="text-sm font-semibold text-main">
              {text(settings.language, "Primärfarbe", "Primary color")}
            </span>
            <div className="mt-3 flex items-center gap-4">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(event) =>
                  updateSettings({
                    primaryColor: event.target.value,
                  })
                }
                className="h-12 w-16 cursor-pointer rounded-lg border border-black/10 bg-transparent"
              />
              <code className="text-sm font-semibold text-muted">
                {settings.primaryColor}
              </code>
            </div>
          </label>

          <label className="panel rounded-2xl p-4">
            <span className="text-sm font-semibold text-main">
              {text(settings.language, "Sekundärfarbe", "Secondary color")}
            </span>
            <div className="mt-3 flex items-center gap-4">
              <input
                type="color"
                value={settings.secondaryColor}
                onChange={(event) =>
                  updateSettings({
                    secondaryColor: event.target.value,
                  })
                }
                className="h-12 w-16 cursor-pointer rounded-lg border border-black/10 bg-transparent"
              />
              <code className="text-sm font-semibold text-muted">
                {settings.secondaryColor}
              </code>
            </div>
          </label>
        </div>
      </div>
    </section>
  );
}
