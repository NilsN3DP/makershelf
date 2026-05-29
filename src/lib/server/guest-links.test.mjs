import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGuestZipPath,
  canGuestAccessFile,
  createGuestToken,
  isGuestLinkActive,
  sanitizeDownloadName,
} from "./guest-links-core.js";

test("createGuestToken returns a long URL-safe token", () => {
  const token = createGuestToken();

  assert.match(token, /^[A-Za-z0-9_-]{32,}$/);
});

test("sanitizeDownloadName removes path separators and unsafe characters", () => {
  assert.equal(sanitizeDownloadName("../evil:model?.stl"), "evil-model-.stl");
  assert.equal(sanitizeDownloadName(""), "download");
});

test("buildGuestZipPath keeps files inside the project archive", () => {
  assert.equal(
    buildGuestZipPath({
      name: "part.stl",
      originalPath: "../outside/part.stl",
      folderPath: "../outside",
      storedPath: "Projects/Test/part.stl",
    }),
    "part.stl",
  );

  assert.equal(
    buildGuestZipPath({
      name: "part.stl",
      originalPath: "body/part.stl",
      folderPath: "body",
      storedPath: "Projects/Test/body/part.stl",
    }),
    "body/part.stl",
  );
});

test("isGuestLinkActive rejects expired and revoked links", () => {
  const now = new Date("2026-05-19T12:00:00.000Z");

  assert.equal(isGuestLinkActive({ expiresAt: null, revokedAt: null }, now), true);
  assert.equal(isGuestLinkActive({ expiresAt: new Date("2026-05-20T12:00:00.000Z"), revokedAt: null }, now), true);
  assert.equal(isGuestLinkActive({ expiresAt: new Date("2026-05-18T12:00:00.000Z"), revokedAt: null }, now), false);
  assert.equal(isGuestLinkActive({ expiresAt: null, revokedAt: new Date("2026-05-19T11:00:00.000Z") }, now), false);
});

test("canGuestAccessFile only allows files from the guest project", () => {
  const project = {
    files: [
      { id: "file_allowed" },
      { id: "file_other_allowed" },
    ],
  };

  assert.equal(canGuestAccessFile(project, "file_allowed"), true);
  assert.equal(canGuestAccessFile(project, "file_denied"), false);
});
