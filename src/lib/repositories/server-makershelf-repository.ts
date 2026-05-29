"use client";

import type { MakershelfRepository } from "@/src/lib/repositories/makershelf-repository";
import { createSnapshotRequestInit } from "@/src/lib/snapshot-cache-core.mjs";

export function createServerMakershelfRepository(): MakershelfRepository {
  return {
    async loadSnapshot() {
      const response = await fetch("/api/data/snapshot", createSnapshotRequestInit());

      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Server snapshot could not be loaded.");
      }

      return response.json();
    },
    async saveSnapshot() {
      return;
    },
    async clearSnapshot() {
      return;
    },
  };
}
