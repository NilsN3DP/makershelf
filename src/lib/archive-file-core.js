export const SUPPORTED_ARCHIVE_EXTENSIONS = [
  "zip",
  "zipx",
  "rar",
  "7z",
  "tar.gz",
  "tgz",
  "tar.bz2",
  "tbz",
  "tbz2",
  "tar.xz",
  "txz",
  "tar.zst",
  "tzst",
  "tar.lz",
  "tlz",
  "tar.lzma",
  "tar",
  "gz",
  "bz2",
  "xz",
  "zst",
  "lz",
  "lzma",
  "lz4",
  "cab",
  "iso",
];

export function getArchiveExtension(filename) {
  const normalized = String(filename ?? "").trim().toLowerCase();
  return SUPPORTED_ARCHIVE_EXTENSIONS.find((extension) => normalized.endsWith(`.${extension}`)) ?? "";
}

export function isSupportedArchiveFile(filename) {
  return getArchiveExtension(filename) !== "";
}

export function isZipArchiveFile(filename) {
  const extension = getArchiveExtension(filename);
  return extension === "zip";
}
