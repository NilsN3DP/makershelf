import { test } from "node:test";
import assert from "node:assert/strict";

import { pickSelectedZipFiles } from "./project-zip-export-core.js";

test("pickSelectedZipFiles keeps project order and only selected files", () => {
  const files = [
    { id: "a", name: "first.stl" },
    { id: "b", name: "second.3mf" },
    { id: "c", name: "third.step" },
  ];

  assert.deepEqual(pickSelectedZipFiles(files, new Set(["c", "a"])), [
    { id: "a", name: "first.stl" },
    { id: "c", name: "third.step" },
  ]);
});

test("pickSelectedZipFiles returns an empty list when nothing is selected", () => {
  assert.deepEqual(pickSelectedZipFiles([{ id: "a", name: "first.stl" }], new Set()), []);
});
