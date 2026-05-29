import assert from "node:assert/strict";
import test from "node:test";

import {
  createSnapshotNoStoreHeaders,
  createSnapshotRequestInit,
} from "./snapshot-cache-core.mjs";

test("snapshot requests bypass browser and proxy caches", () => {
  assert.deepEqual(createSnapshotRequestInit(), {
    credentials: "same-origin",
    cache: "no-store",
  });
});

test("snapshot responses tell browsers and proxies not to cache user data", () => {
  assert.deepEqual(createSnapshotNoStoreHeaders(), {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
});
