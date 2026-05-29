import { randomBytes } from "node:crypto";

export function createGuestSubmissionToken() {
  return randomBytes(32).toString("base64url");
}

export function isGuestSubmissionLinkActive(link, now = new Date()) {
  if (link.revokedAt) return false;
  if (link.expiresAt && link.expiresAt <= now) return false;
  return true;
}

export function sanitizeGuestSubmissionLabel(value) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  return cleaned || "Gast-Projekt erstellen";
}
