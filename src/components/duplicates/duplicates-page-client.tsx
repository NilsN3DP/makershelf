"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

export function DuplicatesPageClient() {
  const { duplicates, resolveDuplicateGroup, settings } = useMakershelf();
  const [selection, setSelection] = useState<Record<string, string[]>>({});

  const effectiveSelection = useMemo(() => {
    return Object.fromEntries(
      duplicates.map((group) => [
        group.key,
        selection[group.key] && selection[group.key].length > 0
          ? selection[group.key]
          : group.files.map((entry) => entry.file.id),
      ]),
    ) as Record<string, string[]>;
  }, [duplicates, selection]);

  function getNewestFileId(group: (typeof duplicates)[number]) {
    return [...group.files].sort(
      (left, right) =>
        new Date(right.file.uploadedAt).getTime() -
        new Date(left.file.uploadedAt).getTime(),
    )[0]?.file.id;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(settings.language, "Mehrfach vorhandene Dateien", "Duplicate files")}</h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              "Dateien die in mehreren Projekten gefunden wurden.",
              "Files found in multiple projects.",
            )}
          </p>
        </div>
      </div>

      {duplicates.length === 0 ? (
        <div className="empty-state panel">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          </div>
          <p className="empty-state-title">{text(settings.language, "Keine Duplikate erkannt.", "No duplicates detected.")}</p>
          <p className="empty-state-desc">{text(settings.language, "Alle Dateien sind einzigartig.", "All files are unique.")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {duplicates.map((group) => (
            <div key={group.key} className="panel">
              <div className="panel-section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <h2 className="panel-title">
                  {group.files[0]?.file.originalName}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="badge badge-neutral">
                    {group.files.length} {text(settings.language, "Treffer", "matches")}
                  </span>
                  <button
                    onClick={() =>
                      resolveDuplicateGroup(group.key, effectiveSelection[group.key] ?? [])
                    }
                    className="btn btn-secondary btn-sm"
                  >
                    {text(settings.language, "Auswahl behalten", "Keep selection")}
                  </button>
                  <button
                    onClick={() => {
                      const newestFileId = getNewestFileId(group);
                      if (newestFileId) {
                        resolveDuplicateGroup(group.key, [newestFileId]);
                      }
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    {text(settings.language, "Nur neueste behalten", "Keep newest only")}
                  </button>
                </div>
              </div>

              <div className="panel-section" style={{ paddingTop: 0 }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {text(
                    settings.language,
                    "Markiere die Dateien, die behalten werden sollen. Nicht markierte Duplikate werden entfernt.",
                    "Select the files you want to keep. Unselected duplicates will be removed.",
                  )}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 16px 16px" }}>
                {group.files.map((entry) => {
                  const selected = (effectiveSelection[group.key] ?? []).includes(entry.file.id);
                  const isNewest = getNewestFileId(group) === entry.file.id;
                  return (
                    <label
                      key={`${entry.projectId}-${entry.file.id}`}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                        background: selected ? "var(--primary-soft)" : "var(--panel-muted)",
                        border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: "8px",
                        padding: "12px",
                        cursor: "pointer",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            setSelection((current) => {
                              const currentGroup = effectiveSelection[group.key] ?? [];
                              return {
                                ...current,
                                [group.key]: event.target.checked
                                  ? [...currentGroup, entry.file.id]
                                  : currentGroup.filter((id) => id !== entry.file.id),
                              };
                            })
                          }
                          style={{ marginTop: "2px" }}
                        />
                        <div>
                          <p style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text-main)" }}>{entry.file.name}</p>
                          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {text(settings.language, "Projekt", "Project")}: {entry.projectTitle}
                          </p>
                          <p style={{ fontSize: "11px", color: "var(--text-soft)", marginTop: "2px" }}>{entry.file.storedPath}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {isNewest ? (
                          <span className="badge badge-success">
                            {text(settings.language, "Neueste", "Newest")}
                          </span>
                        ) : null}
                        <span className="badge badge-neutral">{entry.file.sizeLabel}</span>
                        <span className="badge badge-neutral">
                          {new Date(entry.file.uploadedAt).toLocaleDateString(settings.language === "de" ? "de-DE" : "en-US")}
                        </span>
                        <Link href={`/project/${entry.projectId}`} className="btn btn-ghost btn-sm">
                          {text(settings.language, "Projekt öffnen", "Open project")}
                        </Link>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
