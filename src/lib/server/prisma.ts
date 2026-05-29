import { PrismaClient } from "@prisma/client";

import { getServerEnv } from "@/src/lib/server/env";
import { resolvePrismaDatabaseUrl } from "@/src/lib/server/database-url";

declare global {
  var __makershelfPrisma__: PrismaClient | undefined;
}

const env = getServerEnv();
const datasourceUrl = resolvePrismaDatabaseUrl(env.DATABASE_URL);

export const prisma =
  globalThis.__makershelfPrisma__ ??
  new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__makershelfPrisma__ = prisma;
}
