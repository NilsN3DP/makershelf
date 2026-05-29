import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { chromium } from "playwright";

const baseUrl = process.env.MAKERSHELF_BASE_URL ?? "http://127.0.0.1:3000";
const projectCount = Number(process.env.MAKERSHELF_STRESS_PROJECTS ?? 750);
const filesPerProject = Number(process.env.MAKERSHELF_STRESS_FILES_PER_PROJECT ?? 12);
const concurrency = Number(process.env.MAKERSHELF_STRESS_CONCURRENCY ?? 8);
const outputDir = process.env.MAKERSHELF_STRESS_OUTPUT ?? ".qa-artifacts/stress";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isoOffset(index) {
  const date = new Date(Date.now() - index * 3_600_000);
  return date.toISOString();
}

function makeState() {
  const categories = Array.from({ length: 12 }, (_, index) => ({
    id: `cat-${index}`,
    name: `Stress Kategorie ${index + 1}`,
    emoji: ["🛠️", "🤖", "🎭", "📦", "🚀", "🧪"][index % 6],
    description: "Automatisch erzeugte Kategorie fuer Lasttests.",
    color: ["#f97316", "#0ea5e9", "#22c55e", "#a855f7"][index % 4],
  }));

  const creators = Array.from({ length: 80 }, (_, index) => ({
    id: `creator-${index}`,
    name: `Stress Creator ${String(index + 1).padStart(2, "0")}`,
    folders: [
      { id: `creator-${index}-parts`, name: "Parts" },
      { id: `creator-${index}-docs`, name: "Docs" },
    ],
  }));

  const projects = Array.from({ length: projectCount }, (_, projectIndex) => {
    const creator = creators[projectIndex % creators.length];
    const category = categories[projectIndex % categories.length];
    const createdAt = isoOffset(projectIndex);
    const files = Array.from({ length: filesPerProject }, (_, fileIndex) => {
      const type = ["STL", "3MF", "OBJ", "STEP", "GCODE", "PDF"][fileIndex % 6];
      const extension = type === "3MF" ? "3mf" : type.toLowerCase();
      const folderPath = fileIndex % 3 === 0 ? "Root" : `Set ${fileIndex % 5}/Variant ${fileIndex % 3}`;
      return {
        id: `stress-file-${projectIndex}-${fileIndex}`,
        name: `part-${projectIndex}-${fileIndex}.${extension}`,
        originalName: `part-${projectIndex}-${fileIndex}.${extension}`,
        type,
        sizeBytes: 128_000 + fileIndex * 4096,
        sizeLabel: `${Math.round((128_000 + fileIndex * 4096) / 1024)} KB`,
        mimeType: "application/octet-stream",
        originalPath: `${folderPath}/part-${projectIndex}-${fileIndex}.${extension}`,
        folderPath,
        storedPath: `Projects/${creator.name}/Stress Project ${projectIndex + 1}/${folderPath}/part-${projectIndex}-${fileIndex}.${extension}`,
        notes: "Stress-Test-Datei ohne echten Blob.",
        source: fileIndex % 2 === 0 ? "indexing" : "upload",
        uploadedAt: createdAt,
      };
    });

    return {
      id: `stress-project-${projectIndex}`,
      title: `Stress Project ${String(projectIndex + 1).padStart(4, "0")}`,
      description: "Automatisch erzeugtes Projekt zum Testen von grossen Bibliotheken, Filtern und Listen.",
      coverLabel: "Stress",
      coverGradient: projectIndex % 2 === 0
        ? "bg-gradient-to-br from-slate-900 via-slate-800 to-orange-700"
        : "bg-gradient-to-br from-sky-900 via-slate-800 to-slate-950",
      tags: [`tag-${projectIndex % 20}`, projectIndex % 2 === 0 ? "bulk" : "variant"],
      categoryId: category.id,
      creatorId: creator.id,
      creatorFolderId: creator.folders[projectIndex % creator.folders.length]?.id,
      license: projectIndex % 3 === 0 ? "CC BY 4.0" : "Unknown",
      author: creator.name,
      sourceUrl: `https://example.invalid/stress/${projectIndex}`,
      sourcePlatform: "stress",
      thumbnailFileId: undefined,
      lockedFields: [],
      favorite: projectIndex % 11 === 0,
      createdByName: "Stress Bot",
      createdAt,
      updatedAt: createdAt,
      files,
      activity: {
        isActive: projectIndex % 7 === 0,
        printedFileIds: [],
        steps: [],
        shoppingList: [],
        links: [],
      },
    };
  });

  return {
    settings: {
      appName: "makershelf",
      productProfile: "single",
      userName: "Stress Bot",
      language: "de",
      themeMode: "dark",
      deploymentMode: "single-user",
      dataBackend: "browser",
      storageDriver: "filesystem",
      storageMode: "custom-path",
      storagePath: "C:\\MakershelfStress",
      primaryColor: "#f97316",
      secondaryColor: "#1e293b",
      preferredSlicer: "prusa",
      setupCompleted: true,
      pageSize: 24,
      dashboardFeaturedCount: 8,
      maxPreviewFileSizeMb: 150,
    },
    categories,
    creators,
    projects,
    lists: [
      { id: "favorites", name: "Favoriten", projectIds: projects.filter((project) => project.favorite).map((project) => project.id) },
      { id: "stress-hot", name: "Stress Auswahl", projectIds: projects.slice(0, 100).map((project) => project.id) },
    ],
  };
}

async function timed(label, fn) {
  const started = performance.now();
  await fn();
  return { label, ms: Math.round(performance.now() - started) };
}

async function runPageScenario(browser, state, workerIndex) {
  const context = await browser.newContext({ colorScheme: "dark" });
  const consoleErrors = [];
  await context.addInitScript((seedState) => {
    window.localStorage.setItem("makershelf-state", JSON.stringify(seedState));
  }, state);
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const results = [];
  const routes = ["/", "/projects", "/stats", "/favorites", "/lists", "/duplicates", "/categories", "/settings"];
  for (const route of routes) {
    results.push(await timed(`worker-${workerIndex}:${route}`, async () => {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      const body = await page.locator("body").innerText({ timeout: 10_000 });
      assert(!body.includes("Lade makershelf"), `${route}: loading banner is still visible`);
      assert(!body.includes("Application error"), `${route}: application error rendered`);
    }));
  }

  await page.goto(`${baseUrl}/projects`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/Projekte|Tags|Kategorien|Creator/i).fill("Stress Project 07").catch(() => undefined);
  await page.waitForTimeout(250);
  const filteredText = await page.locator("body").innerText();
  assert(/Stress Project/i.test(filteredText), "projects search did not keep stress projects visible");

  await context.close();
  return { results, consoleErrors };
}

async function hammerApi() {
  const endpoints = ["/api/health", "/api/system/status", "/api/auth/session"];
  const results = [];
  for (let index = 0; index < concurrency * 12; index += 1) {
    const endpoint = endpoints[index % endpoints.length];
    results.push(await timed(`api:${endpoint}:${index}`, async () => {
      const response = await fetch(`${baseUrl}${endpoint}`);
      assert(response.status < 500, `${endpoint}: returned ${response.status}`);
      await response.text();
    }));
  }
  return results;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const state = makeState();
  const browser = await chromium.launch({ headless: true });
  try {
    const apiResultsPromise = hammerApi();
    const pageResults = await Promise.all(
      Array.from({ length: concurrency }, (_, index) => runPageScenario(browser, state, index + 1)),
    );
    const apiResults = await apiResultsPromise;
    const timings = [...apiResults, ...pageResults.flatMap((entry) => entry.results)];
    const sorted = timings.map((item) => item.ms).sort((a, b) => a - b);
    const p95 = sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] ?? 0;
    const report = {
      baseUrl,
      projectCount,
      filesPerProject,
      concurrency,
      totalFiles: projectCount * filesPerProject,
      timings,
      p95Ms: p95,
      maxMs: sorted.at(-1) ?? 0,
      consoleErrors: pageResults.flatMap((entry) => entry.consoleErrors),
      generatedAt: new Date().toISOString(),
    };
    writeFileSync(join(outputDir, "stress-report.json"), JSON.stringify(report, null, 2));
    assert(report.consoleErrors.length === 0, `Console errors detected: ${report.consoleErrors.slice(0, 5).join(" | ")}`);
    assert(p95 < 12_000, `P95 is too slow: ${p95}ms`);
    console.log(`Stress test passed: ${projectCount} projects, ${projectCount * filesPerProject} files, concurrency ${concurrency}, p95 ${p95}ms`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Stress test failed");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
