export function normalizeProjectRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/g, "");
}

export function getProjectFileStorageRelativePath(fileType, relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (fileType !== "PDF") {
    return normalized;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase() === "pdf") {
    return segments.join("/");
  }

  return ["PDF", ...segments].join("/");
}
