import path from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/prisma-run.mjs <prisma-args...>");
  process.exit(1);
}

const root = process.cwd();
const provider = (process.env.DATABASE_PROVIDER || "sqlite").trim().toLowerCase();
const schemaPath =
  provider === "postgresql"
    ? path.join(root, "prisma", "schema.postgres.prisma")
    : path.join(root, "prisma", "schema.prisma");

const finalArgs = [...args, "--schema", schemaPath];
const prismaBinary = path.join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

const child =
  process.platform === "win32"
    ? spawn(
        `"${prismaBinary}" ${finalArgs.map((arg) => `"${arg}"`).join(" ")}`,
        {
          cwd: root,
          env: process.env,
          stdio: "inherit",
          shell: true,
        },
      )
    : spawn(prismaBinary, finalArgs, {
        cwd: root,
        env: process.env,
        stdio: "inherit",
      });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
