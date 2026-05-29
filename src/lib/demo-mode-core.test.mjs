import assert from "node:assert/strict";
import test from "node:test";

import { isDemoModeEnabled } from "./demo-mode-core.js";

test("isDemoModeEnabled accepts explicit truthy values", () => {
  assert.equal(isDemoModeEnabled("1"), true);
  assert.equal(isDemoModeEnabled("true"), true);
  assert.equal(isDemoModeEnabled("YES"), true);
});

test("isDemoModeEnabled rejects empty and false values", () => {
  assert.equal(isDemoModeEnabled(""), false);
  assert.equal(isDemoModeEnabled("0"), false);
  assert.equal(isDemoModeEnabled("false"), false);
  assert.equal(isDemoModeEnabled(undefined), false);
});
