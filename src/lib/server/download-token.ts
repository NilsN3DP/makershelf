import { createHmac, timingSafeEqual } from "crypto";

const TTL = 120; // seconds
const FALLBACK_SECRET = "makershelf-bridge-download-token-fallback-secret-32ch";

function getSecret() {
  return process.env.MAKERSHELF_AUTH_SECRET || process.env.MAKERSHELF_AUTH_SECRET || FALLBACK_SECRET;
}

export function createDownloadToken(fileId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + TTL;
  const payload = `${fileId}:${expiry}`;
  const hmac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function createDownloadManifestToken(fileIds: string[]): string {
  const expiry = Math.floor(Date.now() / 1000) + TTL;
  const payload = JSON.stringify({ fileIds, expiry });
  const hmac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, hmac })).toString("base64url");
}

export function verifyDownloadToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const secondLastColon = decoded.lastIndexOf(":", lastColon - 1);
    if (lastColon < 0 || secondLastColon < 0) return null;

    const fileId = decoded.slice(0, secondLastColon);
    const expiry = parseInt(decoded.slice(secondLastColon + 1, lastColon), 10);
    const providedHmac = decoded.slice(lastColon + 1);

    if (isNaN(expiry) || Math.floor(Date.now() / 1000) > expiry) return null;

    const payload = `${fileId}:${expiry}`;
    const expectedHmac = createHmac("sha256", getSecret()).update(payload).digest("hex");

    const a = Buffer.from(providedHmac, "hex");
    const b = Buffer.from(expectedHmac, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return fileId;
  } catch {
    return null;
  }
}

export function verifyDownloadManifestToken(token: string): string[] | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      payload?: string;
      hmac?: string;
    };
    if (!decoded.payload || !decoded.hmac) return null;

    const expectedHmac = createHmac("sha256", getSecret()).update(decoded.payload).digest("hex");
    const a = Buffer.from(decoded.hmac, "hex");
    const b = Buffer.from(expectedHmac, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(decoded.payload) as { fileIds?: unknown; expiry?: unknown };
    if (typeof payload.expiry !== "number" || Math.floor(Date.now() / 1000) > payload.expiry) {
      return null;
    }
    if (!Array.isArray(payload.fileIds)) return null;

    const fileIds = payload.fileIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    return fileIds.length ? fileIds : null;
  } catch {
    return null;
  }
}
