"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/src/components/ui/toast";

type MaterialPreset = {
  material: string;
  densityGcm3?: number | null;
  nozzleTempMinC?: number | null;
  nozzleTempMaxC?: number | null;
  bedTempC?: number | null;
  dryingTempC?: number | null;
  dryingHours?: number | null;
};

type ManufacturerPreset = {
  id: string;
  manufacturer: string;
  aliases?: string[];
  defaultTareWeightGrams?: number | null;
  website?: string | null;
  materials: MaterialPreset[];
};

function formatNumber(value: number | null | undefined, suffix = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${suffix}` : "–";
}

function formatNozzle(material: MaterialPreset) {
  if (typeof material.nozzleTempMinC === "number" && typeof material.nozzleTempMaxC === "number") {
    return material.nozzleTempMinC === material.nozzleTempMaxC
      ? `${material.nozzleTempMinC} °C`
      : `${material.nozzleTempMinC}-${material.nozzleTempMaxC} °C`;
  }
  return "–";
}

function formatDrying(material: MaterialPreset) {
  if (typeof material.dryingTempC !== "number") return "–";
  return typeof material.dryingHours === "number"
    ? `${material.dryingTempC} °C / ${material.dryingHours} h`
    : `${material.dryingTempC} °C`;
}

export function FilamentDatabasePageClient() {
  const { toast } = useToast();
  const [manufacturers, setManufacturers] = useState<ManufacturerPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadPresets() {
      setLoading(true);
      try {
        const response = await fetch("/api/filament/presets", { cache: "no-store" });
        const payload = (await response.json()) as { manufacturers?: ManufacturerPreset[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Material-Datenbank konnte nicht geladen werden.");
        if (!cancelled) {
          const items = payload.manufacturers ?? [];
          setManufacturers(items);
          setExpanded(Object.fromEntries(items.slice(0, 4).map((item) => [item.id, true])));
        }
      } catch (error) {
        if (!cancelled) toast(error instanceof Error ? error.message : "Fehler beim Laden.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPresets();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const stats = useMemo(() => {
    const materialCount = manufacturers.reduce((sum, item) => sum + item.materials.length, 0);
    return { manufacturerCount: manufacturers.length, materialCount };
  }, [manufacturers]);

  const filteredManufacturers = useMemo(() => {
    const manufacturerTerm = search.trim().toLowerCase();
    const materialTerm = materialSearch.trim().toLowerCase();
    return manufacturers
      .map((manufacturer) => {
        const manufacturerMatches =
          !manufacturerTerm ||
          manufacturer.manufacturer.toLowerCase().includes(manufacturerTerm) ||
          (manufacturer.aliases ?? []).some((alias) => alias.toLowerCase().includes(manufacturerTerm));
        const materials = manufacturer.materials.filter((material) => {
          const materialMatches = !materialTerm || material.material.toLowerCase().includes(materialTerm);
          return materialMatches && (manufacturerMatches || !manufacturerTerm);
        });
        return manufacturerMatches || materials.length > 0 ? { ...manufacturer, materials } : null;
      })
      .filter((item): item is ManufacturerPreset => Boolean(item));
  }, [manufacturers, materialSearch, search]);

  const visibleMaterialCount = filteredManufacturers.reduce((sum, item) => sum + item.materials.length, 0);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="panel panel-padded" style={{ color: "var(--text-muted)" }}>
          Material-Datenbank wird geladen...
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Material-Datenbank</h1>
          <p className="page-subtitle">
            {stats.manufacturerCount} Hersteller · {stats.materialCount} Materialprofile
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/filament">
            Zurück zu Filament Vault
          </Link>
        </div>
      </div>

      <section
        className="panel"
        style={{
          padding: "16px",
          marginBottom: "16px",
          display: "grid",
          gap: "12px",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Hersteller</span>
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="z.B. Prusament, Bambu, Polymaker"
          />
        </label>
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>Material</span>
          <input
            className="input"
            value={materialSearch}
            onChange={(event) => setMaterialSearch(event.target.value)}
            placeholder="z.B. PLA, PETG-CF, ASA"
          />
        </label>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setSearch("");
            setMaterialSearch("");
          }}
        >
          Filter löschen
        </button>
      </section>

      <div style={{ display: "grid", gap: "12px" }}>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
          Angezeigt: {filteredManufacturers.length} Hersteller · {visibleMaterialCount} Materialien
        </p>

        {filteredManufacturers.length === 0 ? (
          <div className="panel panel-padded" style={{ color: "var(--text-muted)" }}>
            Keine passenden Materialprofile gefunden.
          </div>
        ) : (
          filteredManufacturers.map((manufacturer) => {
            const isOpen = Boolean(expanded[manufacturer.id]);
            return (
              <section key={manufacturer.id} className="panel" style={{ overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setExpanded((current) => ({ ...current, [manufacturer.id]: !current[manufacturer.id] }))}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                    borderBottom: isOpen ? "1px solid var(--border)" : "none",
                    background: "var(--panel)",
                    color: "var(--text-main)",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: "12px",
                    alignItems: "center",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "grid", gap: "4px", minWidth: 0 }}>
                    <span style={{ fontSize: "16px", fontWeight: 700 }}>{manufacturer.manufacturer}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                      {manufacturer.materials.length} Materialien
                      {typeof manufacturer.defaultTareWeightGrams === "number"
                        ? ` · Spule leer ${manufacturer.defaultTareWeightGrams} g`
                        : ""}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)" }}>
                    {manufacturer.website && (
                      <a
                        className="btn btn-ghost btn-sm"
                        href={manufacturer.website}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Website
                      </a>
                    )}
                    <span style={{ fontSize: "18px", lineHeight: 1 }}>{isOpen ? "−" : "+"}</span>
                  </span>
                </button>

                {isOpen && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                      <thead>
                        <tr style={{ color: "var(--text-soft)", fontSize: "11px", textTransform: "uppercase" }}>
                          <th style={{ textAlign: "left", padding: "10px 16px" }}>Material</th>
                          <th style={{ textAlign: "left", padding: "10px 16px" }}>Dichte</th>
                          <th style={{ textAlign: "left", padding: "10px 16px" }}>Nozzle</th>
                          <th style={{ textAlign: "left", padding: "10px 16px" }}>Bett</th>
                          <th style={{ textAlign: "left", padding: "10px 16px" }}>Trocknen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manufacturer.materials.map((material) => (
                          <tr key={`${manufacturer.id}-${material.material}`} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "11px 16px", fontWeight: 700 }}>{material.material}</td>
                            <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>
                              {formatNumber(material.densityGcm3, " g/cm³")}
                            </td>
                            <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{formatNozzle(material)}</td>
                            <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>
                              {formatNumber(material.bedTempC, " °C")}
                            </td>
                            <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{formatDrying(material)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
