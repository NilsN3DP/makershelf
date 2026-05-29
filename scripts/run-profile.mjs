import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [, , profile, command = "dev"] = process.argv;

if (!profile || !["single", "server"].includes(profile)) {
  console.error("Usage: node scripts/run-profile.mjs <single|server> <dev|build|start|preview>");
  process.exit(1);
}

const root = process.cwd();
const envFile = path.join(root, `.env.${profile}`);
const exampleEnvFile = path.join(root, `.env.${profile}.example`);
const sourceFile = fs.existsSync(envFile) ? envFile : exampleEnvFile;

if (!fs.existsSync(sourceFile)) {
  console.error(`Profile env file not found: ${sourceFile}`);
  process.exit(1);
}

const env = { ...process.env };
const content = fs.readFileSync(sourceFile, "utf8");

for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    continue;
  }

  const separator = trimmed.indexOf("=");
  if (separator === -1) {
    continue;
  }

  const key = trimmed.slice(0, separator).trim();
  const value = trimmed.slice(separator + 1).trim();
  env[key] = value;
}

if (!env.PORT) {
  env.PORT = profile === "single" ? "3001" : "3000";
}

if (!["dev", "build", "start", "preview"].includes(command)) {
  console.error(`Unsupported command "${command}"`);
  process.exit(1);
}

function runChild(binToRun, argsToRun, cwdOverride = root) {
  return new Promise((resolve) => {
    const child = spawn(binToRun, argsToRun, {
      cwd: cwdOverride,
      env,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => resolve(code ?? 0));
  });
}

const shouldPrepareLocalServerDb =
  profile === "server" &&
  ["dev", "start", "preview"].includes(command) &&
  env.DATABASE_PROVIDER === "sqlite";

const shouldPrebuildProfile = ["start", "preview"].includes(command);
const staleStandaloneDbPath = path.join(root, ".next", "standalone", "prisma", "dev.server.db");
const standaloneRoot = path.join(root, ".next", "standalone");
const standaloneStaticPath = path.join(standaloneRoot, ".next", "static");
const buildStaticPath = path.join(root, ".next", "static");

const bootstrap = async () => {
  const prismaGenerateExitCode = await runChild("node", ["scripts/prisma-run.mjs", "generate"]);
  if (prismaGenerateExitCode !== 0) {
    process.exit(prismaGenerateExitCode);
  }

  if (shouldPrepareLocalServerDb) {
    const prepareExitCode = await runChild("node", ["scripts/prepare-server-db.mjs"]);
    if (prepareExitCode !== 0) {
      process.exit(prepareExitCode);
    }
  }

  if (shouldPrebuildProfile) {
    if (fs.existsSync(staleStandaloneDbPath)) {
      fs.rmSync(staleStandaloneDbPath, { force: true });
    }

    const buildExitCode = await runChild("npx", ["next", "build"]);
    if (buildExitCode !== 0) {
      process.exit(buildExitCode);
    }

    if (fs.existsSync(buildStaticPath)) {
      fs.mkdirSync(path.dirname(standaloneStaticPath), { recursive: true });
      fs.cpSync(buildStaticPath, standaloneStaticPath, {
        recursive: true,
        force: true,
      });
    }
  }
};

const startMainCommand = async () => {
  if (command === "dev") {
    return runChild("npx", ["next", "dev"]);
  }

  if (command === "build") {
    return runChild("npx", ["next", "build"]);
  }

  return runChild("node", ["server.js"], standaloneRoot);
};

bootstrap().then(async () => {
  const exitCode = await startMainCommand();
  process.exit(exitCode);
});
