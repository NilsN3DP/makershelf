import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const outputZip = path.resolve(projectRoot, "..", "makershelf-github-ready.zip");

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
    if (sourceStat.isDirectory()) {
      continue;
    }

    await ensureParent(destination);
    await cp(source, destination, { force: true });
  }
};

const createManifest = async (outputDir, files) => {
  const manifestPath = path.join(outputDir, "PACKAGE_CONTENTS.md");
  const manifest = [
    "# makershelf GitHub Package",
    "",
    "This package was generated from the current working tree.",
    "",
    `Generated: ${new Date().toISOString()}`,
    `File count: ${files.length}`,
    "",
    "## Included files",
    "",
    ...files.map((file) => `- \`${file}\``),
    "",
  ].join("\n");

  await writeFile(manifestPath, manifest, "utf8");
};

const main = async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "makershelf-github-package-"));
  const rawList = await runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  const files = rawList
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error("No files found for GitHub export.");
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
        if (entry.isDirectory()) {
          addDir(zip, absolute, relative);
        } else {
          zip.file(relative, fs.readFileSync(absolute));
        }
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

  console.log(`Created GitHub-ready zip: ${outputZip}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
