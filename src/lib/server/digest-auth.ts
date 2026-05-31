import { createHash } from "node:crypto";

function md5(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

function parseDigestChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  const rx = /(\w+)=(?:"([^"]*)"|([\w/+.-]+))/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(header)) !== null) {
    params[m[1]] = m[2] ?? m[3];
  }
  return params;
}

/**
 * Fetch with HTTP Digest authentication (RFC 7616 / RFC 2617).
 * Issues a first request; if the server responds with 401 + Digest challenge,
 * computes the response hash and retries automatically.
 */
export async function fetchWithDigestAuth(
  url: string,
  init: RequestInit,
  username: string,
  password: string,
): Promise<Response> {
  const first = await fetch(url, init);
  if (first.status !== 401) return first;

  const wwwAuth = first.headers.get("WWW-Authenticate") ?? "";
  if (!wwwAuth.startsWith("Digest ")) return first;

  const p = parseDigestChallenge(wwwAuth);
  const { realm = "", nonce = "", qop = "auth", opaque } = p;

  const uri = new URL(url).pathname + new URL(url).search;
  const method = (typeof init.method === "string" ? init.method : "GET").toUpperCase();
  const nc = "00000001";
  const cnonce = Math.random().toString(36).slice(2, 10);

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
    `response="${response}"`,
  ];
  if (qop) parts.push(`qop=${qop}`);
  if (opaque) parts.push(`opaque="${opaque}"`);

  const headers = new Headers(init.headers as HeadersInit | undefined);
  headers.set("Authorization", `Digest ${parts.join(", ")}`);

  return fetch(url, { ...init, headers });
}
