import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isSecuritySetupPage,
  shouldRequireSecuritySetup,
  shouldRequireTwoFactorOnLogin,
} from "./auth-security-core.js";

test("login only requires 2FA after a verified setup is enabled", () => {
  assert.equal(
    shouldRequireTwoFactorOnLogin({
      demoMode: false,
      twoFactorEnabled: false,
      twoFactorSecretVerifiedAt: null,
      role: "ADMIN",
    }),
    false,
  );
  assert.equal(
    shouldRequireTwoFactorOnLogin({
      demoMode: false,
      twoFactorEnabled: true,
      twoFactorSecretVerifiedAt: null,
      role: "ADMIN",
    }),
    false,
  );
  assert.equal(
    shouldRequireTwoFactorOnLogin({
      demoMode: false,
      twoFactorEnabled: true,
      twoFactorSecretVerifiedAt: new Date(),
      role: "ADMIN",
    }),
    true,
  );
});

test("app shell does not block normal pages just because 2FA is disabled", () => {
  assert.equal(
    shouldRequireSecuritySetup({
      loading: false,
      authenticated: true,
      bootstrapRequired: false,
      isPublicRoute: false,
      demoMode: false,
      pathname: "/projects",
      forcePasswordChange: false,
      twoFactorEnabled: false,
    }),
    false,
  );
});

test("app shell still blocks normal pages when a password change is mandatory", () => {
  assert.equal(
    shouldRequireSecuritySetup({
      loading: false,
      authenticated: true,
      bootstrapRequired: false,
      isPublicRoute: false,
      demoMode: false,
      pathname: "/projects",
      forcePasswordChange: true,
      twoFactorEnabled: false,
    }),
    true,
  );
});

test("user page is only treated as security setup for mandatory password changes", () => {
  assert.equal(
    isSecuritySetupPage({
      pathname: "/user",
      authenticated: true,
      demoMode: false,
      forcePasswordChange: false,
      twoFactorEnabled: false,
    }),
    false,
  );
  assert.equal(
    isSecuritySetupPage({
      pathname: "/user",
      authenticated: true,
      demoMode: false,
      forcePasswordChange: true,
      twoFactorEnabled: false,
    }),
    true,
  );
});
