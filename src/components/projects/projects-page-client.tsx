"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { ProjectCard } from "@/src/components/projects/project-card";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";
import {
  filterProjects,
  paginateItems,
  sortProjectsForLibrary,
} from "@/src/lib/project-query";

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

type GuestSubmissionLink = {
  id: string;
  label: string;
  url: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function ProjectsPageClient() {
  const { categories, creators, lists, projects, settings } = useMakershelf();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [listId, setListId] = useState("all");
  const [importedBy, setImportedBy] = useState("all");
  const [page, setPage] = useState(1);
  const [guestSubmissionLinks, setGuestSubmissionLinks] = useState<GuestSubmissionLink[]>([]);
  const [guestSubmissionStatus, setGuestSubmissionStatus] = useState("");
  const [isGuestSubmissionBusy, setIsGuestSubmissionBusy] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const categoryId = searchParams.get("category") ?? "all";
  const creatorId = searchParams.get("creator") ?? "all";
  const tagFilter = searchParams.get("tag") ?? "";

  function updateUrlFilter(name: "category" | "creator", value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (value === "all") nextParams.delete(name);
    else nextParams.set(name, value);
    if (name !== "category") nextParams.delete("category");
    if (name !== "creator") nextParams.delete("creator");
    nextParams.delete("tag");
    setPage(1);
    const queryString = nextParams.toString();
    router.push(queryString ? `/projects?${queryString}` : "/projects");
  }

  async function refreshGuestSubmissionLinks() {
    const response = await fetch("/api/guest-submission-links", {
      cache: "no-store",
    });
    const payload = (await response.json()) as { links?: GuestSubmissionLink[]; error?: string };

    if (!response.ok) {
      throw new Error(payload.error || text(settings.language, "Gast-Erstellungslinks konnten nicht geladen werden.", "Guest submission links could not be loaded."));
    }

    setGuestSubmissionLinks(payload.links ?? []);
  }

  useEffect(() => {
    void refreshGuestSubmissionLinks().catch((error) => {
      setGuestSubmissionStatus(error instanceof Error ? error.message : text(settings.language, "Gast-Erstellungslinks konnten nicht geladen werden.", "Guest submission links could not be loaded."));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateGuestSubmissionLink() {
    setIsGuestSubmissionBusy(true);
    setGuestSubmissionStatus(text(settings.language, "Erstelle Gast-Erstellungslink...", "Creating guest submission link..."));

    try {
      const response = await fetch("/api/guest-submission-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: text(settings.language, "Gast-Projekt erstellen", "Create guest project") }),
      });
      const payload = (await response.json()) as { link?: GuestSubmissionLink; error?: string };

      if (!response.ok || !payload.link) {
        throw new Error(payload.error || text(settings.language, "Gast-Erstellungslink konnte nicht erstellt werden.", "Guest submission link could not be created."));
      }

      setGuestSubmissionLinks((current) => [payload.link as GuestSubmissionLink, ...current]);
      try {
        await navigator.clipboard?.writeText(payload.link.url);
      } catch {
        setGuestSubmissionStatus(text(settings.language, "Gast-Erstellungslink erstellt. Kopieren im Browser nicht erlaubt, der Link steht unten.", "Guest submission link created. Browser copy is blocked, the link is shown below."));
        return;
      }
      setGuestSubmissionStatus(text(settings.language, "Gast-Erstellungslink erstellt und kopiert.", "Guest submission link created and copied."));
    } catch (error) {
      setGuestSubmissionStatus(error instanceof Error ? error.message : text(settings.language, "Gast-Erstellungslink konnte nicht erstellt werden.", "Guest submission link could not be created."));
    } finally {
      setIsGuestSubmissionBusy(false);
    }
  }

  async function handleRevokeGuestSubmissionLink(linkId: string) {
    setIsGuestSubmissionBusy(true);

    try {
      const response = await fetch(`/api/guest-submission-links/${linkId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || text(settings.language, "Gast-Erstellungslink konnte nicht deaktiviert werden.", "Guest submission link could not be revoked."));
      }

      await refreshGuestSubmissionLinks();
      setGuestSubmissionStatus(text(settings.language, "Gast-Erstellungslink deaktiviert.", "Guest submission link revoked."));
    } catch (error) {
      setGuestSubmissionStatus(error instanceof Error ? error.message : text(settings.language, "Gast-Erstellungslink konnte nicht deaktiviert werden.", "Guest submission link could not be revoked."));
    } finally {
      setIsGuestSubmissionBusy(false);
    }
  }

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const creatorsById = useMemo(
    () => new Map(creators.map((creator) => [creator.id, creator])),
    [creators],
  );
  const importers = useMemo(
    () => Array.from(new Set(projects.map((p) => p.createdByName).filter(Boolean) as string[])).sort(),
    [projects],
  );
  const filteredProjects = useMemo(
    () =>
      sortProjectsForLibrary(
        filterProjects({
          projects,
          categoriesById,
          creatorsById,
          lists,
          query: deferredQuery,
          categoryId,
          creatorId,
          listId,
          importedBy,
          tag: tagFilter,
        }),
      ),
    [categoriesById, categoryId, creatorId, creatorsById, deferredQuery, importedBy, listId, lists, projects, tagFilter],
  );
  const pagedProjects = useMemo(
    () => paginateItems(filteredProjects, page, settings.pageSize),
    [filteredProjects, page, settings.pageSize],
  );

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(settings.language, "Projektbibliothek", "Project library")}</h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              "Suche, filtere und verwalte alle vorhandenen Projekte an einem Ort.",
              "Search, filter and manage all existing projects in one place.",
            )}
          </p>
        </div>
        <Link href="/new-project" className="btn btn-primary btn-sm">
          <IconPlus />
          {text(settings.language, "Neues Projekt", "New project")}
        </Link>
      </div>

      <div className="panel panel-padded" style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 className="section-title">{text(settings.language, "Gast-Projekte", "Guest projects")}</h2>
            <p className="text-sm text-muted">
              {text(
                settings.language,
                "Erzeuge einen Link, über den Gäste neue Projekte einreichen. Nach dem Upload bekommt der Gast automatisch einen eigenen Projekt-Gastlink.",
                "Create a link guests can use to submit projects. After upload, they automatically receive a project-only guest link.",
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isGuestSubmissionBusy}
            onClick={() => void handleCreateGuestSubmissionLink()}
          >
            <IconPlus />
            {text(settings.language, "Gast-Erstellungslink", "Guest submission link")}
          </button>
        </div>
        {guestSubmissionStatus ? <p className="mt-3 text-sm text-muted">{guestSubmissionStatus}</p> : null}
        {guestSubmissionLinks.some((l) => !l.revokedAt) ? (
          <div className="mt-4 space-y-2">
            {guestSubmissionLinks.filter((link) => !link.revokedAt).map((link) => (
              <div
                key={link.id}
                className="panel"
                style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}
              >
                <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                  <div className="responsive-actions">
                    <span className="badge badge-neutral">{link.label}</span>
                    <span className="badge badge-success">{text(settings.language, "aktiv", "active")}</span>
                  </div>
                  <input className="input mt-2" readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} />
                </div>
                <div className="responsive-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      void navigator.clipboard?.writeText(link.url);
                      setGuestSubmissionStatus(text(settings.language, "Gast-Erstellungslink kopiert.", "Guest submission link copied."));
                    }}
                  >
                    {text(settings.language, "Kopieren", "Copy")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={isGuestSubmissionBusy}
                    onClick={() => void handleRevokeGuestSubmissionLink(link.id)}
                  >
                    {text(settings.language, "Deaktivieren", "Revoke")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Filter bar */}
      <div className="panel panel-padded" style={{ marginBottom: "1.25rem" }}>
        <div className="responsive-filter-grid">
          <input
            type="search"
            value={query}
            placeholder={text(
              settings.language,
              "Projekte, Tags, Kategorien oder Creator durchsuchen...",
              "Search projects, tags, categories or creators...",
            )}
            className="input"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />

          <select
            className="input select"
            value={categoryId}
            onChange={(event) => {
              updateUrlFilter("category", event.target.value);
            }}
          >
            <option value="all">{text(settings.language, "Alle Kategorien", "All categories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.emoji} {category.name}
              </option>
            ))}
          </select>

          <select
            className="input select"
            value={creatorId}
            onChange={(event) => {
              updateUrlFilter("creator", event.target.value);
            }}
          >
            <option value="all">{text(settings.language, "Alle Creator", "All creators")}</option>
            {creators.map((creator) => (
              <option key={creator.id} value={creator.id}>
                {creator.name}
              </option>
            ))}
          </select>

          <select
            className="input select"
            value={listId}
            onChange={(event) => {
              setListId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">{text(settings.language, "Alle Listen", "All lists")}</option>
            {lists
              .filter((list) => list.id !== "favorites")
              .map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
          </select>

          {importers.length > 0 && (
            <select
              className="input select"
              value={importedBy}
              onChange={(event) => {
                setImportedBy(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{text(settings.language, "Alle Importeure", "All importers")}</option>
              {importers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Result count + pagination */}
      <div className="panel" style={{ padding: "10px 16px", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {text(
              settings.language,
              `${pagedProjects.totalItems} Projekte gefunden, ${settings.pageSize} pro Seite.`,
              `${pagedProjects.totalItems} projects found, ${settings.pageSize} per page.`,
            )}
          </p>
          {tagFilter || categoryId !== "all" || creatorId !== "all" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {tagFilter ? <span className="badge badge-neutral">#{tagFilter}</span> : null}
              {categoryId !== "all" ? (
                <span className="badge badge-neutral">
                  {categories.find((category) => category.id === categoryId)?.name ?? categoryId}
                </span>
              ) : null}
              {creatorId !== "all" ? (
                <span className="badge badge-neutral">
                  {creators.find((creator) => creator.id === creatorId)?.name ?? creatorId}
                </span>
              ) : null}
              <Link href="/projects" className="btn btn-ghost btn-sm">
                {text(settings.language, "Filter entfernen", "Clear filters")}
              </Link>
            </div>
          ) : null}
        </div>
        <div className="responsive-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pagedProjects.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {text(settings.language, "Zurück", "Previous")}
          </button>
          <span className="badge badge-neutral">{pagedProjects.page} / {pagedProjects.totalPages}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pagedProjects.page >= pagedProjects.totalPages}
            onClick={() =>
              setPage((current) => Math.min(pagedProjects.totalPages, current + 1))
            }
          >
            {text(settings.language, "Weiter", "Next")}
          </button>
        </div>
      </div>

      {/* Project grid */}
      {pagedProjects.totalItems === 0 ? (
        <div className="empty-state panel" style={{ padding: "3rem", textAlign: "center" }}>
          <p className="empty-state-title">{text(settings.language, "Keine Projekte gefunden.", "No projects found.")}</p>
          <p className="empty-state-desc">{text(settings.language, "Passe die Filter an oder erstelle ein neues Projekt.", "Adjust filters or create a new project.")}</p>
        </div>
      ) : (
        <div className="responsive-project-grid">
          {pagedProjects.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
