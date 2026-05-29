export const APP_EVENTS = {
  AUTH_UPDATED: "makershelf:auth-updated",
} as const;

export function dispatchAppEvent(name: (typeof APP_EVENTS)[keyof typeof APP_EVENTS]): void {
  window.dispatchEvent(new Event(name));
}

export function onAppEvent(
  name: (typeof APP_EVENTS)[keyof typeof APP_EVENTS],
  callback: () => void,
): () => void {
  window.addEventListener(name, callback);
  return () => window.removeEventListener(name, callback);
}
