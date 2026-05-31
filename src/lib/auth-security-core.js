export function shouldRequireTwoFactorOnLogin({
  demoMode,
  twoFactorEnabled,
  twoFactorSecretVerifiedAt,
  role,
}) {
  void role;
  return !demoMode && Boolean(twoFactorEnabled) && Boolean(twoFactorSecretVerifiedAt);
}

export function shouldRequireSecuritySetup({
  loading,
  authenticated,
  bootstrapRequired,
  isPublicRoute,
  demoMode,
  pathname,
  forcePasswordChange,
  twoFactorEnabled,
}) {
  void twoFactorEnabled;
  return (
    !loading &&
    authenticated &&
    !bootstrapRequired &&
    pathname !== "/user" &&
    !isPublicRoute &&
    !demoMode &&
    Boolean(forcePasswordChange)
  );
}

export function isSecuritySetupPage({
  pathname,
  authenticated,
  demoMode,
  forcePasswordChange,
  twoFactorEnabled,
}) {
  void twoFactorEnabled;
  return pathname === "/user" && authenticated && !demoMode && Boolean(forcePasswordChange);
}
