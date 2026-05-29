/**
 * Headed Playwright screenshot tool.
 * Launches a visible Chrome window, logs in interactively (or auto if creds are given),
 * then takes screenshots of each page and saves to docs/screenshots/.
 *
 * Usage:
 *   node scripts/take-screenshots.mjs                     <- manual login (waits 60s)
 *   node scripts/take-screenshots.mjs email password      <- auto login
 */

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT   = path.join(__dirname, "..", "docs", "screenshots");
const BASE  = process.env.MAKERSHELF_URL ?? "http://192.168.1.234:3000";
const EMAIL = process.argv[2];
const PASS  = process.argv[3];

const VIEWPORT = { width: 1400, height: 780 };

const PAGES = [
  { file: "projects.png",       url: "/projects" },
  { file: "project-detail.png", url: "/projects", action: "click-first-project" },
  { file: "indexing.png",       url: "/import" },
  { file: "lists.png",          url: "/lists" },
  { file: "settings.png",       url: "/settings" },
  { file: "dashboard.png",      url: "/dashboard" },
];

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=1400,840", "--window-position=100,50"],
  });
  const ctx  = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

  if (EMAIL && PASS) {
    // Auto login
    try {
      await page.fill('input[type="email"], input[name="email"]', EMAIL, { timeout: 5000 });
      await page.fill('input[type="password"], input[name="password"]', PASS, { timeout: 5000 });
      await page.click('button[type="submit"]');
      await page.waitForURL(url => !url.toString().includes("/login"), { timeout: 15000 });
      console.log("Logged in automatically.");
    } catch {
      console.log("Auto-login failed, waiting for manual login (60s)...");
      await page.waitForURL(url => !url.toString().includes("/login"), { timeout: 60000 });
    }
  } else {
    console.log("Waiting for manual login in the browser window (60s)...");
    await page.waitForURL(url => !url.toString().includes("/login"), { timeout: 60000 });
    console.log("Logged in.");
  }

  for (const { file, url, action } of PAGES) {
    try {
      await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 15000 });

      if (action === "click-first-project") {
        const card = page.locator("article a, a[href*='/projects/']").first();
        if (await card.isVisible({ timeout: 3000 })) {
          await card.click();
          await page.waitForLoadState("networkidle");
        }
      }

      await page.waitForTimeout(800);
      const dest = path.join(OUT, file);
      await page.screenshot({ path: dest, fullPage: false });
      console.log(`✓  ${file}`);
    } catch (err) {
      console.warn(`⚠  ${file}: ${err.message.split("\n")[0]}`);
    }
  }

  await browser.close();
  console.log("\nDone. Screenshots saved to docs/screenshots/");
}

run().catch(e => { console.error(e); process.exit(1); });
