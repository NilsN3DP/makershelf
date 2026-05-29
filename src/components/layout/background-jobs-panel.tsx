"use client";

import { useMemo, useState } from "react";

import {
  type BackgroundJob,
  useMakershelf,
} from "@/src/components/providers/makershelf-provider";
import {
  describeBackgroundJobProgress,
  summarizeBackgroundJobs,
} from "@/src/lib/background-jobs-core";

function getStatusLabel(job: BackgroundJob) {
  if (job.status === "queued") return "Wartet";
  if (job.status === "running") return "Läuft";
  if (job.status === "failed") return "Fehler";
  return "Fertig";
}

function getPrimaryJob(jobs: BackgroundJob[]) {
  return (
    jobs.find((job) => job.status === "running") ||
    jobs.find((job) => job.status === "queued") ||
    jobs.find((job) => job.status === "failed") ||
    jobs[0]
  );
}

function StatusGlyph({ failed = false }: { failed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: 17,
        height: 17,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {failed ? "!" : "..."}
    </span>
  );
}

export function BackgroundJobsPanel() {
  const { backgroundJobs, dismissBackgroundJob } = useMakershelf();
  const [open, setOpen] = useState(false);
  const visibleJobs = useMemo(
    () => backgroundJobs.filter((job) => job.status !== "completed"),
    [backgroundJobs],
  );
  const summary = useMemo(() => summarizeBackgroundJobs(visibleJobs), [visibleJobs]);
  const primaryJob = getPrimaryJob(visibleJobs);

  if (!summary.hasVisibleJobs || !primaryJob) {
    return null;
  }

  const activeText =
    summary.activeCount > 0
      ? `${summary.activeCount} Job${summary.activeCount === 1 ? "" : "s"} aktiv`
      : `${summary.failedCount} Fehler`;
  const progress = Math.round(summary.averageProgress * 100);

  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 80,
        width: "min(420px, calc(100vw - 32px))",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="panel"
        style={{
          width: "100%",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
          padding: "12px 14px",
          display: "grid",
          gap: "10px",
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={open}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: summary.failedCount > 0 ? "var(--danger-soft)" : "var(--primary-soft)",
              color: summary.failedCount > 0 ? "var(--danger)" : "var(--primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <StatusGlyph failed={summary.failedCount > 0} />
          </span>
          <span style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
              {activeText}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {primaryJob.label}
            </span>
          </span>
          <span
            aria-hidden="true"
            style={{
              color: "var(--text-muted)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            v
          </span>
        </div>
        {summary.activeCount > 0 ? (
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "var(--panel-muted)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 999,
                background: "var(--primary)",
                transition: "width 0.2s",
              }}
            />
          </div>
        ) : null}
      </button>

      {open ? (
        <div
          className="panel"
          style={{
            marginTop: 10,
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
            padding: 12,
            display: "grid",
            gap: 10,
          }}
        >
          {visibleJobs.map((job) => {
            const isFailed = job.status === "failed";
            return (
              <div
                key={job.id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "10px",
                  borderRadius: 8,
                  background: "var(--panel-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      color: isFailed ? "var(--danger)" : "var(--primary)",
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  >
                    <StatusGlyph failed={isFailed} />
                  </span>
                  <span style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                      {job.label}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {getStatusLabel(job)} · {describeBackgroundJobProgress(job)}
                    </span>
                    <span style={{ fontSize: 12, color: isFailed ? "var(--danger)" : "var(--text-muted)" }}>
                      {job.error || job.message}
                    </span>
                  </span>
                  {isFailed ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        dismissBackgroundJob(job.id);
                      }}
                      title="Ausblenden"
                      aria-label="Job ausblenden"
                      style={{ paddingInline: 8 }}
                    >
                      x
                    </button>
                  ) : null}
                </div>
                {!isFailed ? (
                  <div
                    style={{
                      height: 5,
                      borderRadius: 999,
                      background: "var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(job.progress * 100)}%`,
                        height: "100%",
                        background: "var(--primary)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
          {backgroundJobs.some((job) => job.status === "completed") ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
              <span aria-hidden="true" style={{ color: "var(--success)", fontWeight: 800 }}>ok</span>
              Abgeschlossene Jobs werden automatisch ausgeblendet.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
