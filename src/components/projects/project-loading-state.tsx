"use client";

import Link from "next/link";

type ProjectLoadingStateProps = {
  mode?: "detail" | "form";
};

export function ProjectLoadingState({ mode = "detail" }: ProjectLoadingStateProps) {
  const isForm = mode === "form";

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div className="space-y-3">
          <div className="skeleton h-4 w-28 rounded-full" />
          <div className="skeleton h-9 w-72 max-w-full rounded-xl" />
          <div className="skeleton h-4 w-[min(32rem,100%)] rounded-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="skeleton h-10 w-24 rounded-xl" />
          <div className="skeleton h-10 w-28 rounded-xl" />
        </div>
      </header>

      <section className="section-shell p-5">
        <div
          className={
            isForm
              ? "grid gap-4 lg:grid-cols-2"
              : "grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]"
          }
        >
          <div className="panel p-5">
            <div className="space-y-4">
              <div>
                <div className="skeleton h-5 w-36 rounded-full" />
                <div className="mt-3 skeleton h-24 w-full rounded-2xl" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="skeleton h-12 rounded-xl" />
                <div className="skeleton h-12 rounded-xl" />
                <div className="skeleton h-12 rounded-xl" />
                <div className="skeleton h-12 rounded-xl" />
              </div>
              <div className="skeleton h-32 w-full rounded-2xl" />
            </div>
          </div>

          <aside className="panel p-5">
            <div className="space-y-4">
              <div className="skeleton aspect-[4/3] w-full rounded-2xl" />
              <div className="skeleton h-4 w-3/4 rounded-full" />
              <div className="skeleton h-4 w-1/2 rounded-full" />
              <div className="grid grid-cols-3 gap-2">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <p className="text-sm text-muted">
        {isForm ? "Projektformular wird vorbereitet ..." : "Projekt wird geladen ..."}
      </p>
    </div>
  );
}

export function ProjectNotFoundState() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-10">
      <section className="section-shell p-8">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Projekt
          </p>
          <div>
            <h1 className="page-title">Projekt nicht gefunden</h1>
            <p className="page-subtitle mt-2">
              Das Projekt ist nicht mehr vorhanden oder wurde noch nicht geladen. Zur Projektliste kommst du direkt zurück.
            </p>
          </div>
          <Link className="btn-primary inline-flex w-fit" href="/projects">
            Zur Projektliste
          </Link>
        </div>
      </section>
    </div>
  );
}
