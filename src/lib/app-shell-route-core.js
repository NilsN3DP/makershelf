export function isPublicShellRoute(pathname) {
  return (
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/guest/") ||
    pathname.startsWith("/guest-submit/")
  );
}
