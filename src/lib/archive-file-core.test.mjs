import assert from "node:assert/strict";
import test from "node:test";

import {
  getArchiveExtension,
  isSupportedArchiveFile,
  isZipArchiveFile,
} from "./archive-file-core.js";

test("isSupportedArchiveFile accepts common archive formats", () => {
  for (const name of [
    "project.zip",
    "bundle.rar",
    "models.7z",
    "library.tar",
    "backup.tar.gz",
    "backup.tgz",
    "backup.tar.bz2",
    "backup.tbz",
    "backup.tbz2",
    "backup.tar.xz",
    "backup.txz",
    "backup.tar.zst",
    "backup.tzst",
    "backup.tar.lz",
    "backup.tlz",
    "backup.tar.lzma",
    "single.gz",
    "single.bz2",
    "single.xz",
    "single.zst",
    "single.lz4",
    "archive.cab",
    "disc.iso",
  ]) {
    assert.equal(isSupportedArchiveFile(name), true, name);
  }
});

test("getArchiveExtension detects multi-part compression suffixes before final suffixes", () => {
  assert.equal(getArchiveExtension("archive.tar.gz"), "tar.gz");
  assert.equal(getArchiveExtension("archive.tar.bz2"), "tar.bz2");
  assert.equal(getArchiveExtension("archive.tar.xz"), "tar.xz");
  assert.equal(getArchiveExtension("archive.tar.zst"), "tar.zst");
  assert.equal(getArchiveExtension("archive.tar.lzma"), "tar.lzma");
});

test("isZipArchiveFile only marks zip-like archives as extractable", () => {
  assert.equal(isZipArchiveFile("project.zip"), true);
  assert.equal(isZipArchiveFile("project.zipx"), false);
  assert.equal(isZipArchiveFile("project.rar"), false);
  assert.equal(isZipArchiveFile("project.7z"), false);
});
