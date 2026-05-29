import { test } from "node:test";
import assert from "node:assert/strict";

import { getProjectFileStorageRelativePath } from "./project-file-storage-core.js";

test("getProjectFileStorageRelativePath stores root PDFs in PDF folder", () => {
  assert.equal(
    getProjectFileStorageRelativePath("PDF", "manual.pdf"),
    "PDF/manual.pdf",
  );
});

test("getProjectFileStorageRelativePath keeps existing PDF folder without duplicating it", () => {
  assert.equal(
    getProjectFileStorageRelativePath("PDF", "PDF/manual.pdf"),
    "PDF/manual.pdf",
  );
});

test("getProjectFileStorageRelativePath preserves nested PDF source below PDF folder", () => {
  assert.equal(
    getProjectFileStorageRelativePath("PDF", "docs/manual.pdf"),
    "PDF/docs/manual.pdf",
  );
});

test("getProjectFileStorageRelativePath leaves model files unchanged", () => {
  assert.equal(
    getProjectFileStorageRelativePath("STL", "parts/body.stl"),
    "parts/body.stl",
  );
});
