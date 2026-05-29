import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const prismaDir = path.join(root, "prisma");
const runtimeDbPath = path.join(prismaDir, "dev.server.db");
const templateDbPath = path.join(prismaDir, "dev.server.template.db");

if (!fs.existsSync(runtimeDbPath)) {
  if (!fs.existsSync(templateDbPath)) {
    console.error(`Missing server SQLite template: ${templateDbPath}`);
    process.exit(1);
  }

  fs.copyFileSync(templateDbPath, runtimeDbPath);
  console.log(`Created local server database from template: ${runtimeDbPath}`);
}

// Keep the preview database aligned with the current Prisma schema. The
// template can lag behind after auth or team-model changes.
const pushResult = spawnSync(process.execPath, ["scripts/prisma-run.mjs", "db", "push"], {
  cwd: root,
  env: {
    ...process.env,
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || "sqlite",
    DATABASE_URL: process.env.DATABASE_URL || "file:./dev.server.db",
  },
  stdio: "inherit",
});

if (pushResult.status !== 0) {
  process.exit(pushResult.status ?? 1);
}
