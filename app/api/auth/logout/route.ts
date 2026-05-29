import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, invalidateSession } from "@/src/lib/server/auth/session";

function shouldUseSecureCookie(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.toLowerCase() ?? "";
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const hostnameFromHeader = (forwardedHost || host).split(":")[0];
  if (hostnameFromHeader === "localhost" || hostnameFromHeader === "127.0.0.1") {
    return false;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return false;
  }

  if (url.protocol === "https:") {
    return true;
  }

  return process.env.NODE_ENV === "production";
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token) {
    await invalidateSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    expires: new Date(0),
    path: "/",
  });

  return response;
}
