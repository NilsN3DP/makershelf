import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const prismaDir = path.join(root, "prisma");
const runtimeDbPath = path.join(prismaDir, "dev.single.db");
const templateDbPath = path.join(prismaDir, "dev.single.template.db");

if (fs.existsSync(runtimeDbPath)) {
  process.exit(0);
}

if (!fs.existsSync(templateDbPath)) {
  console.error(`Missing single SQLite template: ${templateDbPath}`);
  process.exit(1);
}

fs.copyFileSync(templateDbPath, runtimeDbPath);
console.log(`Created local single database from template: ${runtimeDbPath}`);
