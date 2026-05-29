import { test } from "node:test";
import assert from "node:assert/strict";

import { isPublicShellRoute } from "./app-shell-route-core.js";

test("isPublicShellRoute allows guest project links without login", () => {
  assert.equal(isPublicShellRoute("/guest/public-token"), true);
  assert.equal(isPublicShellRoute("/guest/public-token/"), true);
});

test("isPublicShellRoute allows guest project submission links without login", () => {
  assert.equal(isPublicShellRoute("/guest-submit/public-token"), true);
  assert.equal(isPublicShellRoute("/guest-submit/public-token/"), true);
});

test("isPublicShellRoute keeps normal project routes private", () => {
  assert.equal(isPublicShellRoute("/project/abc"), false);
  assert.equal(isPublicShellRoute("/projects"), false);
});
