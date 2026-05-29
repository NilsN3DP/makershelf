"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DevFlag = {
  id: string;
  title: string;
  description: string;
  href?: string;
};

const DEV_FLAGS: DevFlag[] = [
  {
    id: "workshop-tools",
    title: "Workshop Tools",
    description: "Experimentelle Generatoren wie Puzzle Maker, QR Studio und Hilfsrechner. Nicht im Release-Menue sichtbar.",
    href: "/tools",
  },
  {
    id: "prusa-docker-import",
    title: "PrusaSlicer Docker Import",
    description: "Erlaubt, Projektdateien aus makershelf in einen Server-Ordner zu kopieren, den ein PrusaSlicer-Docker als Import-Volume nutzt.",
  },
  {
    id: "experimental-viewers",
    title: "Experimentelle Viewer",
    description: "Spielwiese für alternative STEP/GCODE/3MF-Viewer und Thumbnail-Experimente.",
  },
  {
    id: "import-lab",
    title: "Import Lab",
    description: "Tests für direkte Plattform-Imports, Metadaten-Parsing und neue Dateiquellen.",
  },
];

const storageKey = "makershelf.dev.flags";

function readFlags() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const value = window.localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeFlags(flags: Set<string>) {
  window.localStorage.setItem(storageKey, JSON.stringify([...flags]));
}

export function DevPageClient() {
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => setEnabled(readFlags()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle(id: string) {
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      writeFlags(next);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <section className="hero-card">
        <p className="eyebrow">DEV</p>
        <h1>Experimentelle Features</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Dieser Bereich ist absichtlich nicht in der normalen Navigation verlinkt. Hier können unfertige Ideen
          aktiviert und getestet werden, ohne dass sie die Release-Oberfläche stören.
        </p>
      </section>

      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Feature Flags</p>
            <h2 className="mt-2 text-2xl font-bold">Lokale Experimente</h2>
            <p className="mt-2 text-sm text-muted">
              Die Schalter werden nur in diesem Browser gespeichert. Server- und Team-Funktionen bleiben davon unberührt.
            </p>
          </div>
          <Link className="btn-secondary" href="/projects">Zurück zur App</Link>
        </div>

        <div className="mt-6 grid gap-4">
          {DEV_FLAGS.map((flag) => {
            const active = enabled.has(flag.id);
            return (
              <article key={flag.id} className="rounded-2xl border border-border bg-panel-soft p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-bold">{flag.title}</h3>
                    <p className="mt-2 text-sm text-muted">{flag.description}</p>
                    {flag.href && active && (
                      <Link className="mt-4 inline-flex btn-secondary" href={flag.href}>
                        Experiment öffnen
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    className={active ? "btn-primary" : "btn-secondary"}
                    onClick={() => toggle(flag.id)}
                  >
                    {active ? "Aktiv" : "Aktivieren"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
