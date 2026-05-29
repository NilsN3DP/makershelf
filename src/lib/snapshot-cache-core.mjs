/**
 * @returns {RequestInit}
 */
export function createSnapshotRequestInit() {
  return {
    credentials: "same-origin",
    cache: "no-store",
  };
}

/**
 * @returns {Record<string, string>}
 */
export function createSnapshotNoStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}
