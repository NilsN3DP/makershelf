import fs from "node:fs";
import path from "node:path";

const envArg = process.argv[2] || ".env.live";
const envPath = path.resolve(process.cwd(), envArg);

if (!fs.existsSync(envPath)) {
  console.error(`[live-check] Missing env file: ${envPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8");
const entries = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const required = [
  "DATABASE_PROVIDER",
  "DATABASE_URL",
  "MAKERSHELF_PRODUCT_PROFILE",
  "MAKERSHELF_DEPLOYMENT_MODE",
  "MAKERSHELF_DATA_BACKEND",
  "MAKERSHELF_STORAGE_DRIVER",
  "MAKERSHELF_STORAGE_ROOT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "MAKERSHELF_BOOTSTRAP_EMAIL",
  "MAKERSHELF_BOOTSTRAP_PASSWORD",
];

const missing = required.filter((key) => !entries[key]);

const placeholderHits = [
  ["POSTGRES_PASSWORD", "change-this-strong-password"],
  ["MAKERSHELF_BOOTSTRAP_PASSWORD", "ChangeThisAdminPassword!"],
  ["MAKERSHELF_BOOTSTRAP_EMAIL", "admin@example.com"],
  ["POSTGRES_PASSWORD", "replace-with-a-strong-db-password"],
  ["MAKERSHELF_BOOTSTRAP_PASSWORD", "replace-with-a-strong-admin-password"],
  ["MAKERSHELF_BOOTSTRAP_EMAIL", "replace-with-admin@example.com"],
].filter(([key, placeholder]) => entries[key] === placeholder);

const issues = [];

if (missing.length) {
  issues.push(`Missing required values: ${missing.join(", ")}`);
}

if (entries.DATABASE_PROVIDER && entries.DATABASE_PROVIDER !== "postgresql") {
  issues.push("DATABASE_PROVIDER should be set to postgresql for the live stack.");
}

if (entries.MAKERSHELF_PRODUCT_PROFILE && entries.MAKERSHELF_PRODUCT_PROFILE !== "server") {
  issues.push("MAKERSHELF_PRODUCT_PROFILE should be server for the live stack.");
}

if (entries.MAKERSHELF_DEPLOYMENT_MODE && entries.MAKERSHELF_DEPLOYMENT_MODE !== "docker-team") {
  issues.push("MAKERSHELF_DEPLOYMENT_MODE should be docker-team for the live stack.");
}

if (entries.MAKERSHELF_DATA_BACKEND && entries.MAKERSHELF_DATA_BACKEND !== "postgres") {
  issues.push("MAKERSHELF_DATA_BACKEND should be postgres for the live stack.");
}

if (entries.MAKERSHELF_STORAGE_DRIVER && entries.MAKERSHELF_STORAGE_DRIVER !== "filesystem") {
  issues.push("MAKERSHELF_STORAGE_DRIVER should be filesystem for the live stack.");
}

if (placeholderHits.length) {
  issues.push(
    `Replace placeholder credentials before publishing: ${placeholderHits
      .map(([key]) => key)
      .join(", ")}`,
  );
}

if (issues.length) {
  console.error("[live-check] Environment check failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`[live-check] ${path.basename(envPath)} looks publish-ready.`);
