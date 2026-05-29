import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const profile = process.argv[2];

if (!profile || !["single", "server"].includes(profile)) {
  console.error("Usage: node scripts/export-profile-package.mjs <single|server>");
  process.exit(1);
}

const outputZip = path.resolve(
  projectRoot,
  "..",
  profile === "single"
    ? "makershelf-Single-github-ready.zip"
    : "makershelf-Server-github-ready.zip",
);

const excludedByProfile = {
  single: [
    "docker-compose.server.yml",
    "docker-compose.live.yml",
    "docker-compose.publish.yml",
    "docker-compose.unraid.yml",
    "deploy/makershelf-unraid.xml",
    "docs/SERVER_EDITION.md",
    ".env.server.example",
    ".env.live.example",
    ".env.publish.example",
  ],
  server: [
    "docker-compose.single.yml",
    "docs/SINGLE_EDITION.md",
    ".env.single.example",
  ],
};

const runGit = async (args) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd: projectRoot,
    maxBuffer: 1024 * 1024 * 16,
  });
  return stdout;
};

const ensureParent = async (filePath) => {
  await mkdir(path.dirname(filePath), { recursive: true });
};

const copyListedFiles = async (outputDir, files) => {
  for (const relativePath of files) {
    const source = path.join(projectRoot, relativePath);
    const destination = path.join(outputDir, relativePath);
    const sourceStat = await stat(source);
    if (sourceStat.isDirectory()) continue;
    await ensureParent(destination);
    await cp(source, destination, { force: true });
  }
};

const createManifest = async (outputDir, files) => {
  const manifestPath = path.join(outputDir, "PACKAGE_CONTENTS.md");
  const manifest = [
    `# makershelf ${profile === "single" ? "Single" : "Server"} Package`,
    "",
    "This package was generated from the current working tree.",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Profile: ${profile}`,
    `File count: ${files.length}`,
    "",
    "## Included files",
    "",
    ...files.map((file) => `- \`${file}\``),
    "",
  ].join("\n");

  await writeFile(manifestPath, manifest, "utf8");
};

async function main() {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), `makershelf-${profile}-package-`));
  const rawList = await runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  const excluded = new Set(excludedByProfile[profile]);
  const files = rawList
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !excluded.has(entry))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error("No files found for profile export.");
  }

  await rm(outputZip, { force: true });
  await copyListedFiles(outputDir, files);
  await createManifest(outputDir, files);

  const zipScript = `
    const fs = require("node:fs");
    const path = require("node:path");
    const JSZip = require("jszip");
    const sourceDir = ${JSON.stringify(outputDir)};
    const zipPath = ${JSON.stringify(outputZip)};
    const addDir = (zip, dir, relativeBase = "") => {
      const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const absolute = path.join(dir, entry.name);
        const relative = relativeBase ? path.posix.join(relativeBase, entry.name) : entry.name;
        if (entry.isDirectory()) addDir(zip, absolute, relative);
        else zip.file(relative, fs.readFileSync(absolute));
      }
    };
    const zip = new JSZip();
    addDir(zip, sourceDir);
    zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } })
      .then((buffer) => fs.writeFileSync(zipPath, buffer));
  `;

  await execFileAsync("node", ["-e", zipScript], {
    cwd: projectRoot,
    maxBuffer: 1024 * 1024 * 16,
  });

  await rm(outputDir, { recursive: true, force: true });
  console.log(`Created ${profile} package: ${outputZip}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
