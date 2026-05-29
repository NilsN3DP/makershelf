import test from "node:test";
import assert from "node:assert/strict";

import {
  clampJobProgress,
  describeBackgroundJobProgress,
  summarizeBackgroundJobs,
} from "./background-jobs-core.js";

test("clampJobProgress keeps progress between 0 and 1", () => {
  assert.equal(clampJobProgress(-0.5), 0);
  assert.equal(clampJobProgress(0.42), 0.42);
  assert.equal(clampJobProgress(2), 1);
});

test("summarizeBackgroundJobs counts active and failed jobs", () => {
  const summary = summarizeBackgroundJobs([
    { status: "queued", progress: 0 },
    { status: "running", progress: 0.5 },
    { status: "completed", progress: 1 },
    { status: "failed", progress: 0.75 },
  ]);

  assert.deepEqual(summary, {
    activeCount: 2,
    failedCount: 1,
    completedCount: 1,
    totalCount: 4,
    averageProgress: 0.25,
    hasVisibleJobs: true,
  });
});

test("describeBackgroundJobProgress prefers processed totals over percentages", () => {
  assert.equal(
    describeBackgroundJobProgress({ processed: 7, total: 12, progress: 0.58 }),
    "7 von 12 Dateien",
  );
  assert.equal(describeBackgroundJobProgress({ progress: 0.58 }), "58%");
});
