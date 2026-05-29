"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ProjectCard } from "@/src/components/projects/project-card";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconScan() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function IconActivity() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IconWarning() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function HomePageClient() {
  const { creators, duplicates, projects, settings, lists } = useMakershelf();
  const activeProjects = useMemo(
    () => projects.filter((p) => p.activity?.isActive),
    [projects],
  );

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => {
          const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return db - da;
        })
        .slice(0, settings.dashboardFeaturedCount),
    [projects, settings.dashboardFeaturedCount],
  );

  const totalFiles = useMemo(
    () => projects.reduce((sum, p) => sum + p.files.length, 0),
    [projects],
  );

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {text(settings.language, "Dashboard", "Dashboard")}
          </h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              `${settings.appName || "makershelf"} Arbeitsbereich`,
              `${settings.appName || "makershelf"} workspace`,
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/new-project" className="btn btn-primary btn-sm">
            <IconPlus />
            {text(settings.language, "Neues Projekt", "New project")}
          </Link>
          <Link href="/indexing" className="btn btn-secondary btn-sm">
            <IconScan />
            {text(settings.language, "Massenimport", "Bulk import")}
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "2rem" }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <div className="stat-card-value">{projects.length}</div>
          <div className="stat-card-label">{text(settings.language, "Projekte", "Projects")}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="stat-card-value">{totalFiles}</div>
          <div className="stat-card-label">{text(settings.language, "Dateien", "Files")}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="stat-card-value">{creators.length}</div>
          <div className="stat-card-label">Creator</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
            <IconActivity />
          </div>
          <div className="stat-card-value">{activeProjects.length}</div>
          <div className="stat-card-label">{text(settings.language, "Aktive Projekte", "Active projects")}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: "var(--secondary-soft)", color: "var(--text-muted)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" />
            </svg>
          </div>
          <div className="stat-card-value">{lists.length}</div>
          <div className="stat-card-label">{text(settings.language, "Listen", "Lists")}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>
        {/* Left: recent projects */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
              {text(settings.language, "Zuletzt aktualisiert", "Recently updated")}
            </h2>
            <Link href="/projects" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
              {text(settings.language, "Alle anzeigen", "View all")}
              <IconArrow />
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="empty-state panel" style={{ padding: "3rem" }}>
              <div className="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
              </div>
              <p className="empty-state-title">{text(settings.language, "Noch keine Projekte", "No projects yet")}</p>
              <p className="empty-state-desc">{text(settings.language, "Lege dein erstes Projekt an oder importiere Dateien.", "Create your first project or import files.")}</p>
              <div style={{ display: "flex", gap: "8px", marginTop: "1rem" }}>
                <Link href="/new-project" className="btn btn-primary btn-sm">
                  {text(settings.language, "Neues Projekt", "New project")}
                </Link>
                <Link href="/indexing" className="btn btn-secondary btn-sm">
                  {text(settings.language, "Importieren", "Import")}
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Duplicates alert */}
          {duplicates.length > 0 && (
            <div className="panel" style={{ padding: "14px 16px", borderLeft: "3px solid var(--warning)" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ color: "var(--warning)", marginTop: "1px" }}><IconWarning /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "2px" }}>
                    {text(settings.language, "Duplikate gefunden", "Duplicates found")}
                  </p>
                  <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                    {duplicates.length} {text(settings.language, "Duplikat-Gruppen", "duplicate groups")}
                  </p>
                  <Link href="/duplicates" className="btn btn-secondary btn-sm" style={{ marginTop: "10px" }}>
                    {text(settings.language, "Anzeigen", "Review")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Active projects */}
          <div className="panel">
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontWeight: 700, fontSize: "13.5px" }}>
                {text(settings.language, "Aktive Projekte", "Active projects")}
              </p>
              <span className="badge badge-primary">{activeProjects.length}</span>
            </div>
            <div>
              {activeProjects.length === 0 ? (
                <p style={{ padding: "14px 16px", fontSize: "13px", color: "var(--text-muted)" }}>
                  {text(settings.language, "Keine aktiven Projekte.", "No active projects.")}
                </p>
              ) : (
                activeProjects.slice(0, 6).map((project) => (
                  <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    className="project-list-row"
                    style={{ padding: "10px 16px" }}
                  >
                    <div className="project-list-info">
                      <p className="project-list-title" style={{ fontSize: "13px" }}>{project.title}</p>
                      <p className="project-list-meta" style={{ fontSize: "12px" }}>
                        {project.activity?.printedFileIds.length ?? 0}/{project.files.length} {text(settings.language, "gedruckt", "printed")}
                      </p>
                    </div>
                    <IconArrow />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="panel panel-padded">
            <p style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "10px" }}>
              {text(settings.language, "Schnellzugriff", "Quick actions")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Link href="/new-project" className="btn btn-secondary" style={{ justifyContent: "flex-start", gap: "8px" }}>
                <IconPlus />
                {text(settings.language, "Neues Projekt", "New project")}
              </Link>
              <Link href="/indexing" className="btn btn-secondary" style={{ justifyContent: "flex-start", gap: "8px" }}>
                <IconScan />
                {text(settings.language, "Massenimport", "Bulk import")}
              </Link>
              <Link href="/duplicates" className="btn btn-secondary" style={{ justifyContent: "flex-start", gap: "8px" }}>
                <IconCopy />
                {text(settings.language, "Duplikate prüfen", "Check duplicates")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
