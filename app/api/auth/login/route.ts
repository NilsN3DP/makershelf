import { NextResponse } from "next/server";
import { z } from "zod";

import { createUserSession, AUTH_COOKIE_NAME } from "@/src/lib/server/auth/session";

const MAX_LOGIN_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000;

type RateLimitEntry = { count: number; resetAt: number };
const loginAttempts = new Map<string, RateLimitEntry>();
let lastCleanup = 0;

function pruneExpiredAttempts(now: number) {
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (now - lastCleanup > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    pruneExpiredAttempts(now);
    lastCleanup = now;
  }
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_LOGIN_ATTEMPTS;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
import { verifyPassword } from "@/src/lib/server/auth/password";
import { verifyBackupCode, verifyTotpToken } from "@/src/lib/server/auth/totp";
import { ensureFirstUserAdmin } from "@/src/lib/server/admin-integrity";
import { authenticateLdapUser, getEffectiveLdapConfig } from "@/src/lib/server/auth/ldap";
import { shouldRequireTwoFactorOnLogin } from "@/src/lib/auth-security-core";
import { isDemoModeEnabled } from "@/src/lib/demo-mode-core";
import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  token: z.string().trim().optional(),
});

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

  return false;
}

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Anmeldeversuche. Bitte warte 15 Minuten." },
      { status: 429 },
    );
  }

  try {
    const body = loginSchema.parse(await request.json());
    const loginIdentifier = body.email.toLowerCase();

    // --- LDAP authentication path ---
    const ldapConfig = await getEffectiveLdapConfig();
    if (ldapConfig) {
      const ldapResult = await authenticateLdapUser(loginIdentifier, body.password);

      if (!ldapResult.ok) {
        // If LDAP failed with "not found", fall through to local auth.
        // If LDAP returned a credential error, reject immediately.
        if (ldapResult.error !== "Benutzer wurde im Verzeichnis nicht gefunden.") {
          return NextResponse.json({ ok: false, error: ldapResult.error }, { status: 401 });
        }
        // else: fall through to local auth below
      } else {
        // LDAP authentication succeeded — auto-provision or update the user
        const workspace = await prisma.workspace.findFirst();
        if (!workspace) {
          return NextResponse.json(
            { ok: false, error: "Kein Workspace konfiguriert." },
            { status: 500 },
          );
        }

        let user = await prisma.user.findUnique({ where: { email: ldapResult.email } });

        if (!user) {
          // First LDAP login: provision the user
          user = await prisma.user.create({
            data: {
              email: ldapResult.email,
              name: ldapResult.name,
              passwordHash: "",
              role: ldapResult.role,
              authProvider: "ldap",
              ldapDn: ldapResult.dn,
              memberships: {
                create: {
                  workspaceId: workspace.id,
                  role: ldapResult.role,
                  status: "ACTIVE",
                },
              },
            },
          });
        } else {
          // Subsequent LDAP login: sync role and DN
          await prisma.$transaction([
            prisma.user.update({
              where: { id: user.id },
              data: {
                role: ldapResult.role,
                authProvider: "ldap",
                ldapDn: ldapResult.dn,
              },
            }),
            prisma.workspaceMember.updateMany({
              where: { userId: user.id, workspaceId: workspace.id },
              data: { role: ldapResult.role },
            }),
          ]);
          user = { ...user, role: ldapResult.role };
        }

        const session = await createUserSession(user.id, {
          userAgent: request.headers.get("user-agent") ?? undefined,
          ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        });

        const response = NextResponse.json({
          ok: true,
          requiresTwoFactor: false,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            forcePasswordChange: false,
            twoFactorEnabled: user.twoFactorEnabled,
          },
        });

        response.cookies.set({
          name: AUTH_COOKIE_NAME,
          value: session.token,
          httpOnly: true,
          sameSite: "lax",
          secure: shouldUseSecureCookie(request),
          expires: session.expiresAt,
          path: "/",
        });

        return response;
      }
    }

    // --- Local authentication path ---
    let user = await prisma.user.findUnique({
      where: { email: loginIdentifier },
      include: { twoFactorSecret: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Benutzer wurde nicht gefunden." },
        { status: 401 },
      );
    }

    // LDAP-provisioned users may not have a local password
    if (user.authProvider === "ldap" && !user.passwordHash) {
      return NextResponse.json(
        { ok: false, error: "Dieser Account wird über LDAP verwaltet." },
        { status: 401 },
      );
    }

    const passwordValid = await verifyPassword(body.password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { ok: false, error: "Passwort ist ungueltig." },
        { status: 401 },
      );
    }

    await ensureFirstUserAdmin(user.id);
    user =
      (await prisma.user.findUnique({
        where: { id: user.id },
        include: { twoFactorSecret: true },
      })) ?? user;

    const demoMode = isDemoModeEnabled(getServerEnv().MAKERSHELF_DEMO_MODE);
    const requiresTwoFactor = shouldRequireTwoFactorOnLogin({
      demoMode,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecretVerifiedAt: user.twoFactorSecret?.verifiedAt ?? null,
      role: user.role,
    });

    if (requiresTwoFactor && user.twoFactorSecret) {
      if (!body.token) {
        return NextResponse.json(
          { ok: false, requiresTwoFactor: true, error: "Ein Authenticator-Code wird benoetigt." },
          { status: 401 },
        );
      }

      const validToken = (() => {
        try {
          return verifyTotpToken(user.twoFactorSecret.secret, body.token);
        } catch {
          return false;
        }
      })();
      const backupCodes = Array.isArray(user.twoFactorSecret.backupCodes)
        ? user.twoFactorSecret.backupCodes.filter((code): code is string => typeof code === "string")
        : [];
      const matchingBackupCode = validToken
        ? ""
        : backupCodes.find((code) => verifyBackupCode(code, body.token ?? ""));

      if (!validToken) {
        if (!matchingBackupCode) {
          return NextResponse.json(
            {
              ok: false,
              requiresTwoFactor: true,
              error: "Authenticator-Code ist ungueltig.",
            },
            { status: 401 },
          );
        }

        await prisma.twoFactorSecret.update({
          where: { userId: user.id },
          data: {
            backupCodes: backupCodes.filter((code) => code !== matchingBackupCode),
          },
        });
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret.verifiedAt) {
        await prisma.$transaction([
          prisma.twoFactorSecret.update({
            where: { userId: user.id },
            data: { verifiedAt: new Date() },
          }),
          prisma.user.update({
            where: { id: user.id },
            data: { twoFactorEnabled: true },
          }),
        ]);
      }
    }

    const session = await createUserSession(user.id, {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    const response = NextResponse.json({
      ok: true,
      requiresTwoFactor: false,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        forcePasswordChange: user.forcePasswordChange,
        twoFactorEnabled: demoMode ? true : user.twoFactorEnabled,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      expires: session.expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Login fehlgeschlagen.",
      },
      { status: 400 },
    );
  }
}
