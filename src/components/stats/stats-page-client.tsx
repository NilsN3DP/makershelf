"use client";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

export function StatsPageClient() {
  const { stats, settings } = useMakershelf();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(settings.language, "Statistiken", "Statistics")}</h1>
          <p className="page-subtitle">{text(settings.language, "Ausgebaute Bibliotheksübersicht", "Expanded library overview")}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "1.5rem" }}>
        {[
          [text(settings.language, "Projekte", "Projects"), stats.totalProjects],
          [text(settings.language, "Dateien", "Files"), stats.totalFiles],
          [text(settings.language, "Kategorien", "Categories"), stats.totalCategories],
          [text(settings.language, "Ersteller", "Creators"), stats.totalCreators],
          [text(settings.language, "Favoriten", "Favorites"), stats.favoriteProjects],
          [text(settings.language, "Listen", "Lists"), stats.customLists],
          [text(settings.language, "Duplikate", "Duplicates"), stats.duplicateGroups],
          [text(settings.language, "ZIP-Importe", "ZIP imports"), stats.zippedFiles],
          [text(settings.language, "Website-Importe", "Website imports"), stats.websiteImports],
          [text(settings.language, "Indexierte Dateien", "Indexed files"), stats.indexedImports],
        ].map(([label, value]) => (
          <div key={label} className="stat-card">
            <div className="stat-card-value">{value}</div>
            <div className="stat-card-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <div className="panel">
          <div className="panel-section">
            <h2 className="panel-title">
              {text(settings.language, "Dateien nach Typ", "Files by type")}
            </h2>
          </div>
          <div style={{ padding: "0 0 8px" }}>
            {stats.filesByType.map((entry) => (
              <div key={entry.type} className="project-list-row" style={{ padding: "10px 16px" }}>
                <span style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text-main)" }}>{entry.type}</span>
                <span className="badge badge-neutral">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-section">
            <h2 className="panel-title">
              {text(settings.language, "Projekte nach Kategorie", "Projects by category")}
            </h2>
          </div>
          <div style={{ padding: "0 0 8px" }}>
            {stats.projectsByCategory.map((entry) => (
              <div key={entry.category} className="project-list-row" style={{ padding: "10px 16px" }}>
                <span style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text-main)" }}>{entry.category}</span>
                <span className="badge badge-neutral">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-section">
            <h2 className="panel-title">
              {text(settings.language, "Größte Dateien", "Largest files")}
            </h2>
          </div>
          <div style={{ padding: "0 0 8px" }}>
            {stats.largestFiles.map((entry) => (
              <div key={`${entry.projectTitle}-${entry.fileName}`} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>{entry.fileName}</p>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{entry.projectTitle}</p>
                <p style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--primary)", marginTop: "2px" }}>{entry.sizeLabel}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
