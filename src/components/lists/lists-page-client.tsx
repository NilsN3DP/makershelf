"use client";

import { useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

export function ListsPageClient() {
  const {
    lists,
    projects,
    createList,
    deleteList,
    addProjectToList,
    removeProjectFromList,
    settings,
  } = useMakershelf();
  const [listName, setListName] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  async function copyShareLink(url: string, successMessage: string, errorMessage: string) {
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShareStatus(successMessage);
    } catch {
      setShareStatus(errorMessage);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(settings.language, "Projektlisten", "Project lists")}</h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              "Lege eigene Listen an und sammle Projekte für bestimmte Themen, Aufträge oder Workflows.",
              "Create custom lists and collect projects for specific topics, jobs or workflows.",
            )}
          </p>
        </div>
      </div>

      {/* Create list */}
      <div className="panel panel-padded" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            className="input"
            value={listName}
            onChange={(event) => setListName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && listName.trim()) {
                void createList(listName).then(() => setListName(""));
              }
            }}
            placeholder={text(settings.language, "Neue Liste", "New list")}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={async () => {
              if (!listName.trim()) return;
              await createList(listName);
              setListName("");
            }}
            className="btn btn-primary"
          >
            {text(settings.language, "Liste anlegen", "Create list")}
          </button>
        </div>
        {shareStatus && <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>{shareStatus}</p>}
      </div>

      {/* Custom lists */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "1rem" }}>
        {lists
          .filter((list) => list.id !== "favorites")
          .map((list) => {
            const listProjects = projects.filter((project) =>
              list.projectIds.includes(project.id),
            );

            return (
              <div key={list.id} id={list.id} className="panel">
                <div className="panel-section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <h2 className="panel-title">
                    {list.name}
                  </h2>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const shareUrl = `${window.location.origin}/lists#${list.id}`;
                        await copyShareLink(
                          shareUrl,
                          text(settings.language, "Listenlink geteilt.", "List link shared."),
                          text(settings.language, "Listenlink konnte nicht geteilt werden.", "List link could not be shared."),
                        );
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      {text(settings.language, "Link kopieren", "Copy link")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteList(list.id)}
                      className="btn btn-ghost btn-sm"
                    >
                      {text(settings.language, "Löschen", "Delete")}
                    </button>
                  </div>
                </div>

                <div style={{ padding: "8px 16px" }}>
                  <select
                    className="input select"
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      void addProjectToList(list.id, event.target.value);
                      event.target.value = "";
                    }}
                  >
                    <option value="">
                      {text(settings.language, "Projekt hinzufügen…", "Add project…")}
                    </option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 16px 16px" }}>
                  {listProjects.length === 0 ? (
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      {text(settings.language, "Keine Projekte in dieser Liste.", "No projects in this list.")}
                    </p>
                  ) : (
                    listProjects.map((project) => (
                      <div
                        key={project.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          background: "var(--panel-muted)",
                          borderRadius: "7px",
                          padding: "10px 12px",
                        }}
                      >
                        <div>
                          <p style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)" }}>{project.title}</p>
                          {project.author && <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{project.author}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeProjectFromList(list.id, project.id)}
                          className="btn btn-ghost btn-sm"
                        >
                          {text(settings.language, "Entfernen", "Remove")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
