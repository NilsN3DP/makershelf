import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");
const standaloneStaticDir = path.join(standaloneRoot, ".next", "static");
const sourceStaticDir = path.join(root, ".next", "static");
const standalonePublicDir = path.join(standaloneRoot, "public");
const sourcePublicDir = path.join(root, "public");
const desktopAppRoot = path.join(root, "desktop-app");
const desktopStandaloneRoot = path.join(desktopAppRoot, ".next", "standalone");
const desktopStandaloneStaticDir = path.join(desktopStandaloneRoot, ".next", "static");
const desktopStandalonePublicDir = path.join(desktopStandaloneRoot, "public");
const releaseDesktopDir = path.join(root, "release-desktop");
const standaloneReleaseDesktopDir = path.join(standaloneRoot, "release-desktop");
const singleTemplateDb = path.join(root, "prisma", "dev.single.template.db");
const singleRuntimeDb = path.join(root, "prisma", "dev.single.db");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    verbatimSymlinks: false,
  });
}

if (!fs.existsSync(singleTemplateDb)) {
  if (!fs.existsSync(singleRuntimeDb)) {
    throw new Error(`Missing single database template and runtime DB: ${singleTemplateDb}`);
  }

  fs.copyFileSync(singleRuntimeDb, singleTemplateDb);
}

fs.rmSync(releaseDesktopDir, { recursive: true, force: true });

run("node", ["scripts/generate-app-icons.mjs"]);
run("node", ["scripts/run-profile.mjs", "single", "build"]);

fs.rmSync(standaloneReleaseDesktopDir, { recursive: true, force: true });
copyDirectory(sourceStaticDir, standaloneStaticDir);
copyDirectory(sourcePublicDir, standalonePublicDir);
fs.rmSync(desktopAppRoot, { recursive: true, force: true });
copyDirectory(standaloneRoot, desktopStandaloneRoot);
copyDirectory(sourceStaticDir, desktopStandaloneStaticDir);
copyDirectory(sourcePublicDir, desktopStandalonePublicDir);

console.log("Desktop bundle prepared.");
