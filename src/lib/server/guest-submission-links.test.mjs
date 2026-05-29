import assert from "node:assert/strict";
import test from "node:test";

import {
  createGuestSubmissionToken,
  isGuestSubmissionLinkActive,
  sanitizeGuestSubmissionLabel,
} from "./guest-submission-links-core.js";

test("createGuestSubmissionToken returns a long URL-safe token", () => {
  const token = createGuestSubmissionToken();

  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
});

test("isGuestSubmissionLinkActive rejects expired and revoked links", () => {
  const now = new Date("2026-05-19T12:00:00.000Z");

  assert.equal(isGuestSubmissionLinkActive({ expiresAt: null, revokedAt: null }, now), true);
  assert.equal(isGuestSubmissionLinkActive({ expiresAt: new Date("2026-05-20T12:00:00.000Z"), revokedAt: null }, now), true);
  assert.equal(isGuestSubmissionLinkActive({ expiresAt: new Date("2026-05-18T12:00:00.000Z"), revokedAt: null }, now), false);
  assert.equal(isGuestSubmissionLinkActive({ expiresAt: null, revokedAt: new Date("2026-05-19T11:00:00.000Z") }, now), false);
});

test("sanitizeGuestSubmissionLabel keeps labels compact and useful", () => {
  assert.equal(sanitizeGuestSubmissionLabel("  Mirko Upload  "), "Mirko Upload");
  assert.equal(sanitizeGuestSubmissionLabel(""), "Gast-Projekt erstellen");
  assert.equal(sanitizeGuestSubmissionLabel("x".repeat(120)).length, 80);
});
