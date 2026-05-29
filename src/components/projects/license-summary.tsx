"use client";

type LicenseRule = {
  label: string;
  status: "required" | "allowed" | "forbidden";
};

type LicensePreset = {
  family: string;
  version: string;
  headline: string;
  summary: string;
  rules: LicenseRule[];
};

function getLicensePreset(license: string): LicensePreset {
  const normalized = license.trim().toLowerCase();

  if (normalized.includes("cc by-nc-nd")) {
    return {
      family: "Creative Commons",
      version: "4.0 International",
      headline: "CC BY-NC-ND",
      summary:
        "Weitergabe mit Namensnennung ist erlaubt, aber nicht kommerziell und nicht als bearbeitete Version.",
      rules: [
        { label: "Namensnennung", status: "required" },
        { label: "Weitergabe unverändert", status: "allowed" },
        { label: "Bearbeitungen / Remixes", status: "forbidden" },
        { label: "Kommerzielle Nutzung", status: "forbidden" },
        { label: "Offene Kultur", status: "forbidden" },
      ],
    };
  }

  if (normalized.includes("cc by-nc-sa")) {
    return {
      family: "Creative Commons",
      version: "4.0 International",
      headline: "CC BY-NC-SA",
      summary:
        "Nicht-kommerzielle Nutzung und Bearbeitung sind erlaubt, wenn du nennst und unter gleichen Bedingungen teilst.",
      rules: [
        { label: "Namensnennung", status: "required" },
        { label: "Weitergabe", status: "allowed" },
        { label: "Bearbeitungen / Remixes", status: "allowed" },
        { label: "Kommerzielle Nutzung", status: "forbidden" },
        { label: "Gleiche Lizenz bei Weitergabe", status: "required" },
      ],
    };
  }

  if (normalized.includes("cc by-nc")) {
    return {
      family: "Creative Commons",
      version: "4.0 International",
      headline: "CC BY-NC",
      summary:
        "Nutzung und Bearbeitung sind erlaubt, solange du den Urheber nennst und nicht kommerziell arbeitest.",
      rules: [
        { label: "Namensnennung", status: "required" },
        { label: "Weitergabe", status: "allowed" },
        { label: "Bearbeitungen / Remixes", status: "allowed" },
        { label: "Kommerzielle Nutzung", status: "forbidden" },
        { label: "Offene Kultur", status: "forbidden" },
      ],
    };
  }

  if (normalized.includes("cc by-sa")) {
    return {
      family: "Creative Commons",
      version: "4.0 International",
      headline: "CC BY-SA",
      summary:
        "Nutzung, Bearbeitung und Weitergabe sind erlaubt, wenn du den Urheber nennst und dieselbe Lizenz beibehältst.",
      rules: [
        { label: "Namensnennung", status: "required" },
        { label: "Weitergabe", status: "allowed" },
        { label: "Bearbeitungen / Remixes", status: "allowed" },
        { label: "Kommerzielle Nutzung", status: "allowed" },
        { label: "Gleiche Lizenz bei Weitergabe", status: "required" },
      ],
    };
  }

  if (normalized.includes("cc by-nd")) {
    return {
      family: "Creative Commons",
      version: "4.0 International",
      headline: "CC BY-ND",
      summary:
        "Unveränderte Weitergabe und Nutzung sind erlaubt, aber keine abgeleiteten oder bearbeiteten Versionen.",
      rules: [
        { label: "Namensnennung", status: "required" },
        { label: "Weitergabe unverändert", status: "allowed" },
        { label: "Bearbeitungen / Remixes", status: "forbidden" },
        { label: "Kommerzielle Nutzung", status: "allowed" },
        { label: "Offene Kultur", status: "forbidden" },
      ],
    };
  }

  if (normalized.includes("cc by")) {
    return {
      family: "Creative Commons",
      version: "4.0 International",
      headline: "CC BY",
      summary:
        "Die offenste CC-Variante hier: Nutzung, Bearbeitung und kommerzielle Weitergabe mit Namensnennung.",
      rules: [
        { label: "Namensnennung", status: "required" },
        { label: "Weitergabe", status: "allowed" },
        { label: "Bearbeitungen / Remixes", status: "allowed" },
        { label: "Kommerzielle Nutzung", status: "allowed" },
        { label: "Offene Kultur", status: "allowed" },
      ],
    };
  }

  if (normalized.includes("personal")) {
    return {
      family: "Custom License",
      version: "Creator Defined",
      headline: "Personal Use",
      summary:
        "Typischerweise nur für privaten Einsatz gedacht. Öffentliche oder kommerzielle Nutzung sollte separat angefragt werden.",
      rules: [
        { label: "Private Nutzung", status: "allowed" },
        { label: "Weitergabe", status: "forbidden" },
        { label: "Bearbeitungen / Remixes", status: "forbidden" },
        { label: "Kommerzielle Nutzung", status: "forbidden" },
        { label: "Offene Kultur", status: "forbidden" },
      ],
    };
  }

  return {
    family: "Custom License",
    version: "Individuell",
    headline: license || "Unbekannt",
    summary:
      "Für diese Lizenz gibt es keine feste Regelmatrix. Bitte die Angaben des Urhebers oder der Projektquelle prüfen.",
    rules: [
      { label: "Private Nutzung", status: "allowed" },
      { label: "Weitergabe", status: "forbidden" },
      { label: "Bearbeitungen / Remixes", status: "forbidden" },
      { label: "Kommerzielle Nutzung", status: "forbidden" },
      { label: "Offene Kultur", status: "forbidden" },
    ],
  };
}

export function LicenseSummary({ license }: { license: string }) {
  const preset = getLicensePreset(license);

  return (
    <section className="panel p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] accent-text">
        Lizenz
      </p>
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--panel-muted)] p-5">
        <p className="text-sm font-semibold text-muted">{preset.family}</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-main">
          {preset.headline}
        </h3>
        <p className="mt-2 text-sm text-soft">{preset.version}</p>
        <p className="mt-4 text-sm leading-6 text-muted">{preset.summary}</p>
      </div>

      <div className="mt-5 grid gap-3">
        {preset.rules.map((rule) => (
          <div
            key={rule.label}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3"
          >
            <span className="text-sm font-medium text-main">{rule.label}</span>
            <span
              className={`rounded-md px-3 py-1 text-xs font-bold ${
                rule.status === "allowed"
                  ? "accent-soft"
                  : rule.status === "required"
                    ? "border border-[var(--primary)] text-[var(--primary)]"
                    : "secondary-soft"
              }`}
            >
              {rule.status === "allowed"
                ? "Erlaubt"
                : rule.status === "required"
                  ? "Erforderlich"
                  : "Nicht erlaubt"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
