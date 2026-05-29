import assert from "node:assert/strict";
import test from "node:test";

import { buildArchiveImportStatus } from "./archive-import-progress-core.js";

test("buildArchiveImportStatus shows current archive progress", () => {
  assert.equal(
    buildArchiveImportStatus({
      name: "Model_17_Sakura_240_v1.0.3.rar",
      index: 1,
      total: 3,
      stage: "extracting",
    }),
    "Archiv 1/3 wird entpackt: Model_17_Sakura_240_v1.0.3.rar",
  );
});

test("buildArchiveImportStatus summarizes extracted and skipped files", () => {
  assert.equal(
    buildArchiveImportStatus({
      name: "bundle.7z",
      index: 1,
      total: 1,
      stage: "done",
      extractedCount: 4,
      skippedCount: 2,
    }),
    "Archiv entpackt: bundle.7z (4 Datei(en), 2 uebersprungen)",
  );
});
