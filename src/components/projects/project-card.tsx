"use client";

import Link from "next/link";
import { useState } from "react";

import { ProjectThumbnail } from "@/src/components/projects/project-thumbnail";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import type { Project } from "@/src/lib/makershelf-data";
import { text } from "@/src/lib/locale";

export function ProjectCard({ project }: { project: Project }) {
  const { categories, creators, settings } = useMakershelf();
  const category = categories.find((item) => item.id === project.categoryId);
  const creator = creators.find((item) => item.id === project.creatorId);
  const creatorFolder = creator?.folders.find((item) => item.id === project.creatorFolderId);
  const thumbnailFile = project.files.find((file) => file.id === project.thumbnailFileId);
  const [shareStatus, setShareStatus] = useState("");
  const locale = settings.language === "de" ? "de-DE" : "en-US";
  const visibleTags = project.tags.slice(0, 3);
  const extraTags = project.tags.length - 3;

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" }).format(new Date(value));
  }

  async function handleShare() {
    try {
      const url = `${window.location.origin}/project/${project.id}`;
      if (navigator.share) {
        await navigator.share({ title: project.title, text: project.description, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShareStatus(text(settings.language, "Link kopiert.", "Link copied."));
      window.setTimeout(() => setShareStatus(""), 1800);
    } catch {
      setShareStatus(text(settings.language, "Teilen fehlgeschlagen.", "Share failed."));
      window.setTimeout(() => setShareStatus(""), 2200);
    }
  }

  return (
    <article className="project-card">
      <Link href={`/project/${project.id}`} style={{ display: "block" }}>
        <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", borderBottom: "1px solid var(--border)" }}>
          <ProjectThumbnail project={project} file={thumbnailFile} />
        </div>
      </Link>

      <div className="project-card-body">
        <Link href={`/project/${project.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <h3 className="project-card-title">{project.title}</h3>
          {project.description && (
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "8px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {project.description}
            </p>
          )}
        </Link>

        {/* Tags row */}
        <div className="project-card-tags">
          {category && (
            <Link href={`/projects?category=${encodeURIComponent(category.id)}`} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 20, fontSize: "11px", fontWeight: 600, background: "var(--secondary-soft)", color: "var(--text-muted)", textDecoration: "none" }}>
              {category.emoji} {category.name}
            </Link>
          )}
          {project.favorite && (
            <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: "11px", fontWeight: 600, background: "var(--warning-soft)", color: "var(--warning)" }}>
              {text(settings.language, "Favorit", "Favourite")}
            </span>
          )}
          {visibleTags.map((tag) => (
            <Link key={tag} href={`/projects?tag=${encodeURIComponent(tag)}`} style={{ padding: "2px 7px", borderRadius: 20, fontSize: "11px", fontWeight: 500, background: "var(--primary-soft)", color: "var(--primary)", textDecoration: "none" }}>
              #{tag}
            </Link>
          ))}
          {extraTags > 0 && (
            <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: "11px", color: "var(--text-soft)" }}>+{extraTags}</span>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)", fontSize: "12px", color: "var(--text-soft)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {creator && (
              <Link href={`/projects?creator=${encodeURIComponent(creator.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
                {creator.name}{creatorFolder ? ` / ${creatorFolder.name}` : ""}
              </Link>
            )}
            {!creator && project.license && <span>{project.license}</span>}
            {project.createdByName && (
              <span style={{ fontSize: "11px", color: "var(--text-soft)", opacity: 0.7 }}>
                {text(settings.language, `von ${project.createdByName}`, `by ${project.createdByName}`)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>{formatDate(project.updatedAt)}</span>
            <button type="button" onClick={() => void handleShare()} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "var(--text-muted)", padding: 0 }}>
              {shareStatus ? shareStatus : text(settings.language, "Teilen", "Share")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
