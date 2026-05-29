import fs from "node:fs";
import path from "node:path";

import JSZip from "jszip";
import { chromium } from "playwright";

const baseUrl = process.env.MAKERSHELF_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.join(process.cwd(), "docs", "screenshots");
const fixtureRoot = path.join(process.cwd(), "qa-artifacts", "screenshots");
const storageRoot = path.join(fixtureRoot, "storage");

function ensureCleanDir(target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}

async function createFixtures() {
  ensureCleanDir(fixtureRoot);
  ensureCleanDir(storageRoot);
  fs.mkdirSync(outputDir, { recursive: true });

  const stlPath = path.join(fixtureRoot, "vault-caddy.stl");
  fs.writeFileSync(
    stlPath,
    "solid vault\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 0 1 0\nvertex 1 0 0\nendloop\nendfacet\nendsolid vault\n",
  );

  const objPath = path.join(fixtureRoot, "divider-tray.obj");
  fs.writeFileSync(objPath, "o DividerTray\nv 0 0 0\nv 0 1 0\nv 1 0 0\nf 1 2 3\n");

  const archive = new JSZip();
  archive.file("prints/replacement-clip.stl", "solid clip\nendsolid clip\n");
  archive.file(
    "links/source.url",
    "[InternetShortcut]\nURL=https://www.printables.com/model/594900-dyson-flat-nozzle-100x4mm-v7-and-later\n",
  );
  const zipPath = path.join(fixtureRoot, "vault-assets.zip");
  fs.writeFileSync(zipPath, await archive.generateAsync({ type: "nodebuffer" }));

  return { stlPath, objPath, zipPath };
}

async function capture(page, name) {
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: true,
  });
}

async function createReleaseContext(browser) {
  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1440, height: 1100 },
  });

  await context.addInitScript((targetPath) => {
    window.localStorage.setItem(
      "makershelf-state",
      JSON.stringify({
        settings: {
          appName: "makershelf",
          productProfile: "single",
          userName: "Release QA",
          language: "de",
          themeMode: "system",
          deploymentMode: "single-user",
          dataBackend: "browser",
          storageDriver: "filesystem",
          storageMode: "custom-path",
          storagePath: targetPath,
          primaryColor: "#f97316",
          secondaryColor: "#1e293b",
          preferredSlicer: "prusa",
          setupCompleted: true,
        },
        categories: [
          {
            id: "technical",
            name: "Technische Teile",
            emoji: "🛠️",
            description: "Mechanische Bauteile, Adapter und Werkstatthelfer.",
            color: "#f97316",
          },
          {
            id: "miniatures",
            name: "Miniaturen",
            emoji: "🧙",
            description: "Figuren, Dioramen und Display-Modelle.",
            color: "#8b5cf6",
          },
        ],
        creators: [
          {
            id: "creator-n3dp",
            name: "N3DP",
            folders: ["Werkstatt", "Release Demo"],
          },
        ],
        projects: [],
        lists: [{ id: "favorites", name: "Favoriten", projectIds: [] }],
      }),
    );
  }, storageRoot);

  return context;
}

async function createSingleUserScreenshots(browser, fixtures) {
  const setupContext = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1440, height: 1100 },
  });
  const setupPage = await setupContext.newPage();
  await setupPage.goto(`${baseUrl}/setup`, { waitUntil: "networkidle" });
  await capture(setupPage, "setup");
  await setupContext.close();

  const context = await createReleaseContext(browser);
  const page = await context.newPage();

  await page.goto(`${baseUrl}/new-project`, { waitUntil: "networkidle" });
  await page.getByLabel("Titel").fill("Vault Desk Caddy");
  await page
    .getByLabel("Beschreibung")
    .fill("Kompakter Organizer mit STL-, OBJ- und ZIP-Dateien fuer Release-Screenshots.");
  await page.getByRole("button", { name: "Projekt anlegen" }).click();
  await page.waitForURL(/\/project\//, { timeout: 15000 });

  await page.locator('input[type="file"][multiple]').setInputFiles([fixtures.stlPath, fixtures.objPath]);
  await page.waitForTimeout(1200);
  await page.locator('input[type="file"]').nth(1).setInputFiles(fixtures.zipPath);
  await page.waitForTimeout(1200);
  await page.getByText("vault-caddy.stl").first().click();
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("3D-Vorschau aktiv") ||
      document.body.innerText.includes("3D preview active"),
    null,
    { timeout: 15000 },
  );

  const detailUrl = page.url();
  await capture(page, "project-detail");

  await page.goto(`${baseUrl}/projects`, { waitUntil: "networkidle" });
  await capture(page, "projects");

  await page.goto(`${baseUrl}/lists`, { waitUntil: "networkidle" });
  await capture(page, "lists");

  await page.goto(`${baseUrl}/indexing`, { waitUntil: "networkidle" });
  await capture(page, "indexing");

  await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });
  await capture(page, "settings");

  await page.goto(detailUrl, { waitUntil: "networkidle" });
  await context.close();
}

async function main() {
  const fixtures = await createFixtures();
  const browser = await chromium.launch({ headless: true });

  try {
    await createSingleUserScreenshots(browser, fixtures);
  } finally {
    await browser.close();
  }

  console.log(`Screenshots refreshed in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
