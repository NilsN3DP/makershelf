import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.MAKERSHELF_BASE_URL ?? "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectNoLoadingBanner(page, routeLabel) {
  await page.waitForTimeout(1200);
  const bodyText = await page.locator("body").innerText();
  assert(
    !bodyText.includes("Lade makershelf"),
    `${routeLabel}: client initialization banner is still visible`,
  );
}

async function runSetupSmoke(browser) {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/setup`, { waitUntil: "networkidle" });
  await expectNoLoadingBanner(page, "/setup");

  const initialTheme = await page.evaluate(() => ({
    datasetTheme: document.documentElement.dataset.theme || "",
    darkClass: document.documentElement.classList.contains("dark"),
  }));
  assert(
    initialTheme.datasetTheme === "dark" || initialTheme.darkClass,
    `/setup: expected system dark mode, got "${initialTheme.datasetTheme || "no theme marker"}"`,
  );
  const setupText = await page.locator("body").innerText();
  assert(
    setupText.includes("makershelf einrichten"),
    "/setup: single setup headline did not render",
  );
  assert(
    setupText.includes("Bitte wähle einen absoluten Ordnerpfad"),
    "/setup: fixed folder requirement did not render",
  );

  await page.getByPlaceholder("Nils").fill("QA User");
  await page.getByRole("button", { name: "Einrichtung abschließen" }).click();
  await page.getByText(/Bitte waehle zuerst einen festen Projektordner/).waitFor({
    state: "visible",
    timeout: 5000,
  });
  await context.close();
}

async function runAppSmoke(browser) {
  const tempDir = mkdtempSync(join(tmpdir(), "makershelf-smoke-"));
  const storageDir = join(tempDir, "projects");
  const context = await browser.newContext({ colorScheme: "dark" });
  await context.addInitScript((targetPath) => {
    window.localStorage.setItem(
      "makershelf-state",
      JSON.stringify({
        settings: {
          appName: "makershelf",
          productProfile: "single",
          userName: "QA User",
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
            description: "QA Kategorie",
            color: "#f97316",
          },
        ],
        creators: [],
        projects: [],
        lists: [{ id: "favorites", name: "Favoriten", projectIds: [] }],
      }),
    );
  }, storageDir);

  const page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await expectNoLoadingBanner(page, "/");

  const homeText = await page.locator("body").innerText();
  assert(
    /makershelf/i.test(homeText),
    "/: dashboard did not load after single-user setup",
  );

  const themeAfterSetup = await page.evaluate(() => ({
    datasetTheme: document.documentElement.dataset.theme || "",
    darkClass: document.documentElement.classList.contains("dark"),
  }));
  assert(
    themeAfterSetup.datasetTheme === "dark" || themeAfterSetup.darkClass,
    `/: expected dark theme after setup, got "${themeAfterSetup.datasetTheme || "no theme marker"}"`,
  );

  await page.goto(`${baseUrl}/projects`, { waitUntil: "networkidle" });
  await expectNoLoadingBanner(page, "/projects");

  await page.goto(`${baseUrl}/new-project`, { waitUntil: "networkidle" });
  await expectNoLoadingBanner(page, "/new-project");

  await page.getByPlaceholder("z. B. Open Frame Filament Rack").fill("QA Smoke Project");
  await page
    .getByPlaceholder("Projektbeschreibung, Druckhinweise und Besonderheiten...")
    .fill("Automatisch angelegtes Testprojekt fuer den Smoke-Test.");
  await page.getByRole("button", { name: "Projekt anlegen" }).click();
  await page.waitForURL(/\/project\//, { timeout: 15000 });
  await expectNoLoadingBanner(page, "/project/[id]");

  const sampleFile = join(tempDir, "smoke-sample.stl");
  writeFileSync(sampleFile, "solid smoke\nendsolid smoke\n", "utf8");

  await page.getByLabel("Dateien auswählen").setInputFiles(sampleFile);
  await page.waitForTimeout(1200);
  const projectText = await page.locator("body").innerText();
  assert(
    projectText.includes("smoke-sample.stl"),
    "/project/[id]: uploaded STL file is not listed",
  );
  assert(
    existsSync(join(storageDir, "_Ohne-Creator", "QA Smoke Project", "smoke-sample.stl")),
    "/project/[id]: uploaded STL file was not copied to the fixed project folder",
  );
  const makershelfInfoPath = join(storageDir, "_Ohne-Creator", "QA Smoke Project", "MakershelfInfo.json");
  assert(
    existsSync(makershelfInfoPath),
    "/project/[id]: MakershelfInfo.json was not written to the fixed project folder",
  );
  const makershelfInfo = readFileSync(makershelfInfoPath, "utf8");
  assert(
    makershelfInfo.includes("makershelf MakershelfInfo") && makershelfInfo.includes("QA Smoke Project"),
    "/project/[id]: MakershelfInfo.json does not contain readable project metadata",
  );

  await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });
  await expectNoLoadingBanner(page, "/settings");
  const settingsText = await page.locator("body").innerText();
  assert(
    settingsText.includes("Einstellungen") && settingsText.includes("GitHub Updates"),
    "/settings: settings page did not render expected content",
  );

  rmSync(tempDir, { recursive: true, force: true });
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await runSetupSmoke(browser);
    await runAppSmoke(browser);
    console.log(`Smoke test passed for ${baseUrl}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`Smoke test failed for ${baseUrl}`);
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
