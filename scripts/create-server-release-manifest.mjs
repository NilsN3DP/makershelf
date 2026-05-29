import fs from "node:fs";
import path from "node:path";

import packageJson from "../package.json" with { type: "json" };

const root = process.cwd();
const outputPath = process.env.MAKERSHELF_RELEASE_MANIFEST_PATH
  ? path.resolve(root, process.env.MAKERSHELF_RELEASE_MANIFEST_PATH)
  : path.join(root, "dist", "server-release-manifest.json");

function readEnv(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function splitList(value) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const version = readEnv("MAKERSHELF_RELEASE_VERSION", packageJson.version);
const channel = readEnv("MAKERSHELF_RELEASE_CHANNEL", "beta");
const image = readEnv("MAKERSHELF_IMAGE", "ghcr.io/nilsn3dp/makershelf-server:beta");
const digest = readEnv("MAKERSHELF_IMAGE_DIGEST");
const tags = splitList(readEnv("MAKERSHELF_IMAGE_TAGS", image));
const changelogUrl = readEnv(
  "MAKERSHELF_CHANGELOG_URL",
  `https://github.com/NilsN3DP/makershelf-releases/releases/tag/v${version}`,
);
const commitSha = readEnv("GITHUB_SHA");
const runUrl = readEnv("MAKERSHELF_WORKFLOW_RUN_URL");

const manifest = {
  schema: "de.n3dp.makershelf.server-release",
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  version,
  channel,
  image,
  digest,
  tags,
  commitSha,
  changelogUrl,
  runUrl,
  productProfile: "server",
  deploymentMode: "docker-team",
  databaseProvider: "postgresql",
  minimumSupportedVersion: "0.2.8",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote server release manifest: ${outputPath}`);
