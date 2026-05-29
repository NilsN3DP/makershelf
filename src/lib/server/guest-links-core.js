import { randomBytes } from "node:crypto";

const unsafeNamePattern = /[<>:"\\|?*\u0000-\u001f]+/g;

export function createGuestToken() {
  return randomBytes(32).toString("base64url");
}

export function sanitizeDownloadName(value) {
  const cleaned = String(value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(unsafeNamePattern, "-")
    .replace(/^\.+/, "")
    .trim();

  return cleaned || "download";
}

function sanitizePathSegment(value) {
  return sanitizeDownloadName(value).replace(/^\.|\.$/g, "") || "folder";
}

export function buildGuestZipPath(file) {
  const rawFolderSegments = String(file.folderPath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  const folderPath = rawFolderSegments.some((segment) => segment === "." || segment === "..")
    ? ""
    : rawFolderSegments.map(sanitizePathSegment).join("/");
  const filename = sanitizeDownloadName(file.originalPath || file.name);
  return folderPath ? `${folderPath}/${filename}` : filename;
}

export function isGuestLinkActive(link, now = new Date()) {
  if (link.revokedAt) return false;
  if (link.expiresAt && link.expiresAt <= now) return false;
  return true;
}

export function canGuestAccessFile(project, fileId) {
  return project.files.some((file) => file.id === fileId);
}
