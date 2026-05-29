"use client";

import Link from "next/link";

import { ProjectCard } from "@/src/components/projects/project-card";
import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

export function FavoritesPageClient() {
  const { projects, settings, setProjectFavorite } = useMakershelf();
  const favorites = projects.filter((project) => project.favorite);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{text(settings.language, "Favoriten", "Favorites")}</h1>
          <p className="page-subtitle">
            {text(
              settings.language,
              "Deine wichtigsten Projekte als eigene Ansicht, getrennt von Projektlisten.",
              "Your most important projects in a dedicated view, separated from project lists.",
            )}
          </p>
        </div>
        <span className="badge badge-primary">{favorites.length}</span>
      </div>

      {favorites.length === 0 ? (
        <section className="panel panel-padded">
          <h2 className="panel-title">
            {text(settings.language, "Noch keine Favoriten", "No favorites yet")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {text(
              settings.language,
              "Markiere Projekte in der Projektbibliothek als Favorit, dann erscheinen sie hier.",
              "Mark projects as favorites in the project library and they will appear here.",
            )}
          </p>
          <Link href="/projects" className="btn btn-primary mt-4">
            {text(settings.language, "Zur Projektbibliothek", "Open project library")}
          </Link>
        </section>
      ) : (
        <div className="project-grid">
          {favorites.map((project) => (
            <div key={project.id} className="space-y-3">
              <ProjectCard project={project} />
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => setProjectFavorite(project.id, false)}
              >
                {text(settings.language, "Aus Favoriten entfernen", "Remove from favorites")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
