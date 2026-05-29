"use client";

import type { MakershelfRepository, MakershelfSnapshot } from "@/src/lib/repositories/makershelf-repository";

export function createBrowserMakershelfRepository(storageKey: string): MakershelfRepository {
  return {
    async loadSnapshot() {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          return JSON.parse(raw) as MakershelfSnapshot;
        }
      } catch {
        // Try sessionStorage as a fallback in constrained embedded browsers.
      }

      try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (!raw) {
          return null;
        }

        return JSON.parse(raw) as MakershelfSnapshot;
      } catch {
        return null;
      }
    },
    async saveSnapshot(snapshot) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        // Try sessionStorage as a fallback in constrained embedded browsers.
      }

      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        // Ignore local persistence failures and keep the app usable.
      }
    },
    async clearSnapshot() {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore local persistence failures and keep the app usable.
      }

      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore local persistence failures and keep the app usable.
      }
    },
  };
}
