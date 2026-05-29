export function clampJobProgress(progress) {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.min(1, Math.max(0, progress));
}

export function summarizeBackgroundJobs(jobs) {
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  const progressTotal = activeJobs.reduce((sum, job) => sum + clampJobProgress(job.progress), 0);

  return {
    activeCount: activeJobs.length,
    failedCount,
    completedCount,
    totalCount: jobs.length,
    averageProgress: activeJobs.length > 0 ? progressTotal / activeJobs.length : 0,
    hasVisibleJobs: activeJobs.length > 0 || failedCount > 0,
  };
}

export function describeBackgroundJobProgress(job) {
  if (Number.isFinite(job.processed) && Number.isFinite(job.total) && job.total > 0) {
    return `${job.processed} von ${job.total} Dateien`;
  }

  return `${Math.round(clampJobProgress(job.progress) * 100)}%`;
}
