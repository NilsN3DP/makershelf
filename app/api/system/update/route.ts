import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import packageJson from "@/package.json";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const GITHUB_OWNER = "NilsN3DP";
const GITHUB_REPO = "makershelf";
const RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DOWNLOAD_DIR = path.join(os.tmpdir(), "Makershelf", "updates");

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
};

type GitHubRelease = {
  tag_name: string;
  name?: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
};

function normalizeVersion(value: string) {
  return value.trim().replace(/^v/i, "");
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function scoreAssetForPlatform(asset: GitHubReleaseAsset, platform = process.platform) {
  const name = asset.name.toLowerCase();
  if (name.endsWith(".blockmap") || name.endsWith(".yml") || name.endsWith(".yaml")) {
    return -1;
  }

  if (platform === "win32") {
    if (!name.endsWith(".exe")) return -1;
    let score = 20;
    if (name.includes("setup")) score += 50;
    if (name.includes("single")) score += 15;
    if (name.includes("portable")) score -= 20;
    if (name.includes("x64") || name.includes("win")) score += 5;
    return score;
  }

  if (platform === "darwin") {
    if (name.endsWith(".dmg")) return 80;
    if (name.endsWith(".zip")) return 40;
    return -1;
  }

  if (platform === "linux") {
    if (name.endsWith(".appimage")) return 80;
    if (name.endsWith(".tar.gz")) return 40;
    return -1;
  }

  return -1;
}

function pickReleaseAsset(release: GitHubRelease) {
  return release.assets
    .map((asset) => ({ asset, score: scoreAssetForPlatform(asset) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score)[0]?.asset;
}

async function fetchLatestRelease() {
  const response = await fetch(RELEASE_API_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Makershelf-Updater",
    },
  });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`GitHub Release konnte nicht geladen werden (${response.status}).`);
  }

  return (await response.json()) as GitHubRelease;
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

async function downloadAsset(asset: GitHubReleaseAsset) {
  const response = await fetch(asset.browser_download_url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Makershelf-Updater",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Update-Datei konnte nicht heruntergeladen werden (${response.status}).`);
  }

  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  const targetPath = path.join(DOWNLOAD_DIR, sanitizeFileName(asset.name));
  const file = await fs.open(targetPath, "w");
  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        await file.write(value);
      }
    }
  } finally {
    reader.releaseLock();
    await file.close();
  }

  return targetPath;
}

async function launchInstaller(filePath: string) {
  if (process.platform === "linux") {
    await fs.chmod(filePath, 0o755);
  }

  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? filePath : filePath;
  const args = process.platform === "darwin" ? [filePath] : [];

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });

  child.unref();
}

function buildPayload(release?: GitHubRelease) {
  const currentVersion = packageJson.version;
  if (!release) {
    return {
      currentVersion,
      latestVersion: "",
      updateAvailable: false,
      releaseName: "",
      releaseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      assetName: "",
      assetSize: 0,
      canInstall: false,
      message:
        "Noch kein GitHub Release gefunden. Erstelle zuerst ein Release mit Installer-Assets, dann kann der Update-Button es automatisch installieren.",
    };
  }

  const asset = pickReleaseAsset(release);
  const latestVersion = normalizeVersion(release.tag_name);

  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    releaseName: release.name || release.tag_name,
    releaseUrl: release.html_url,
    assetName: asset?.name ?? "",
    assetSize: asset?.size ?? 0,
    canInstall: Boolean(asset),
  };
}

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  try {
    const release = await fetchLatestRelease();
    return NextResponse.json(buildPayload(release));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Update konnte nicht geprüft werden.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  return NextResponse.json(
    { error: "Automatische Updates sind im Server-Modus nicht verfügbar. Bitte über Docker aktualisieren." },
    { status: 403 },
  );
}
