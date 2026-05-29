import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { generate } from "otplib";
import { PrismaClient } from "@prisma/client";

import { decryptTotpSecret } from "../src/lib/server/auth/totp.ts";

const baseUrl = process.env.MAKERSHELF_BASE_URL ?? "http://127.0.0.1:3000";
const qaAdmin = {
  name: "QA Admin",
  email: "qa-admin@example.com",
  password: "ChangeMe123!",
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getRecoveryAdmin() {
  const response = await fetch(`${baseUrl}/api/system/recovery`);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const adminUser = (payload.users ?? []).find((user) => user.role === "ADMIN") ?? payload.users?.[0];

  if (!adminUser?.email) {
    return null;
  }

  const recoveryResponse = await fetch(`${baseUrl}/api/system/recovery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminUser.email }),
  });

  if (!recoveryResponse.ok) {
    const text = await recoveryResponse.text();
    throw new Error(`Recovery login bootstrap failed: ${recoveryResponse.status} ${text}`);
  }

  const recoveryPayload = await recoveryResponse.json();
  return {
    email: recoveryPayload.email ?? adminUser.email,
    password: recoveryPayload.temporaryPassword ?? "ChangeMe123!",
  };
}

async function loginAndResetWithCredentials(browser, admin) {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("E-Mail").fill(admin.email);
    await page.getByLabel("Passwort").fill(admin.password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.waitForTimeout(1000);
    const loginText = await page.locator("body").innerText();
    if (loginText.includes("Zwei-Faktor-Authentifizierung")) {
      await page.getByLabel("Authenticator-Code").fill(await createTotpToken(admin.email));
      await page.getByRole("button", { name: "Code bestätigen" }).click();
    }
    await page.waitForURL(`${baseUrl}/`, { timeout: 15000 });

    const resetResponse = await page.evaluate(async () => {
      const response = await fetch("/api/system/reset", { method: "POST" });
      return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
      };
    });

    if (!resetResponse.ok) {
      throw new Error(`Server reset failed after admin login: ${resetResponse.status} ${resetResponse.text}`);
    }

    return true;
  } finally {
    await context.close();
  }
}

async function loginAndResetTeamServerState(browser) {
  try {
    return await loginAndResetWithCredentials(browser, qaAdmin);
  } catch {
    const admin = await getRecoveryAdmin();
    if (!admin) {
      return false;
    }

    return loginAndResetWithCredentials(browser, admin);
  }
}

async function resetTeamServerState(browser) {
  const statusResponse = await fetch(`${baseUrl}/api/system/status`);
  const statusPayload = await statusResponse.json();

  if (statusPayload?.bootstrapRequired) {
    return;
  }

  const response = await fetch(`${baseUrl}/api/system/reset`, { method: "POST" });
  if (response.ok) {
    return;
  }

  const recovered = await loginAndResetTeamServerState(browser);
  if (!recovered) {
    const text = await response.text();
    throw new Error(`Server reset failed: ${response.status} ${text}`);
  }
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    text,
    { timeout: 15000 },
  );
}

async function createTotpToken(email) {
  process.env.MAKERSHELF_AUTH_SECRET = process.env.MAKERSHELF_AUTH_SECRET ?? "replace-with-a-long-random-secret";
  process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER ?? "sqlite";
  process.env.DATABASE_URL =
    process.env.MAKERSHELF_QA_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:../.next/standalone/prisma/dev.server.db";

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { twoFactorSecret: true },
    });

    assert(user?.twoFactorSecret?.secret, `Missing 2FA secret for ${email}`);
    return await generate({ secret: decryptTotpSecret(user.twoFactorSecret.secret) });
  } finally {
    await prisma.$disconnect();
  }
}

async function runTeamFlow(browser) {
  await resetTeamServerState(browser);

  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  const checks = [];

  try {
    await page.goto(`${baseUrl}/setup`, { waitUntil: "networkidle" });
    await waitForText(page, "Team-Einrichtung");
    checks.push(["Team setup page opens", true]);

    const setupText = await page.locator("body").innerText();
    const setupAlreadyExists = setupText.includes("Setup bereits vorhanden");

    if (setupAlreadyExists) {
      await page.getByRole("button", { name: "Team-Setup zurücksetzen" }).click();
      await page.waitForURL(`${baseUrl}/setup`, { timeout: 15000 });
      await waitForText(page, "Team-Einrichtung");
    }

    await page.locator("input").nth(0).fill("QA Workspace");
    await page.locator("input").nth(1).fill(qaAdmin.name);
    await page.locator('input[type="email"]').fill(qaAdmin.email);
    await page.locator('input[type="password"]').fill(qaAdmin.password);
    await page.getByRole("button", { name: "Workspace erstellen" }).click();
    await page.waitForTimeout(1000);
    await page.goto(`${baseUrl}/setup`, { waitUntil: "networkidle" });
    await waitForText(page, "Setup bereits vorhanden");
    checks.push(["Team bootstrap completes", true]);

    const statusResponse = await fetch(`${baseUrl}/api/system/status`);
    const statusPayload = await statusResponse.json();
    checks.push(["Team bootstrap creates workspace", statusPayload.workspaceCount === 1]);
    assert(statusPayload.workspaceCount === 1, "Team bootstrap did not create a workspace");

    await page.getByRole("link", { name: "Zum Login" }).click();
    await page.waitForURL(`${baseUrl}/login`, { timeout: 15000 });
    await page.getByLabel("E-Mail").fill(qaAdmin.email);
    await page.getByLabel("Passwort").fill(qaAdmin.password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await waitForText(page, "Zwei-Faktor-Authentifizierung");
    checks.push(["Team login requires 2FA", true]);
    await page.getByLabel("Authenticator-Code").fill(await createTotpToken(qaAdmin.email));
    await page.getByRole("button", { name: "Code bestätigen" }).click();
    await page.waitForURL(`${baseUrl}/`, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await waitForText(page, "QA Workspace");
    checks.push(["Team login redirects to home without manual reload", true]);

    const homeText = await page.locator("body").innerText();
    const noSingleUserDemo =
      !homeText.includes("Single User Workspace") && !homeText.includes("Hex Wall Lamp");
    checks.push(["Team dashboard does not fall back to single-user demo content", noSingleUserDemo]);
    assert(noSingleUserDemo, "Team dashboard still shows single-user/demo content");

    const importRoot = path.join(process.cwd(), ".next", "standalone", "import", "qa-indexing");
    await fs.mkdir(importRoot, { recursive: true });
    await fs.writeFile(path.join(importRoot, "part.stl"), "solid qa\nendsolid qa", "utf8");

    const indexingResult = await page.evaluate(async () => {
      const projectResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "QA Indexed Project",
          description: "Mass import from folder qa-indexing",
          license: "Unknown",
          tags: ["qa-indexing"],
          author: "QA Admin",
        }),
      });
      const projectPayload = await projectResponse.json();
      if (!projectResponse.ok) {
        return { ok: false, stage: "project", status: projectResponse.status, error: projectPayload.error };
      }

      const fileResponse = await fetch("/api/indexing/server-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectPayload.id,
          manifest: [
            {
              sourcePath: "qa-indexing/part.stl",
              name: "part.stl",
              originalName: "part.stl",
              type: "STL",
              mimeType: "application/octet-stream",
              sizeBytes: 18,
              storedPath: "Projects/_Ohne-Creator/QA Indexed Project/part.stl",
              originalPath: "part.stl",
              folderPath: "",
              notes: "QA server indexing import",
              source: "indexing",
            },
          ],
        }),
      });
      const filePayload = await fileResponse.json();
      if (!fileResponse.ok) {
        return { ok: false, stage: "files", status: fileResponse.status, error: filePayload.error };
      }

      const snapshot = await fetch("/api/data/snapshot").then((response) => response.json());
      const project = snapshot.projects.find((item) => item.title === "QA Indexed Project");
      return {
        ok: Boolean(
          project &&
            project.files?.length === 1 &&
            filePayload.cleanup?.deleted?.includes("qa-indexing/part.stl"),
        ),
        stage: "snapshot",
        files: project?.files?.length ?? 0,
        deleted: filePayload.cleanup?.deleted ?? [],
        cleanupErrors: filePayload.cleanup?.cleanupErrors ?? [],
      };
    });
    const sourceStillExists = await fs
      .access(path.join(importRoot, "part.stl"))
      .then(() => true)
      .catch(() => false);
    checks.push([
      "Server indexing creates a project, persists copied files and cleans import source",
      indexingResult.ok && !sourceStillExists,
    ]);
    assert(
      indexingResult.ok && !sourceStillExists,
      `Server indexing import failed at ${indexingResult.stage}: ${
        indexingResult.error ??
        `${indexingResult.files} files, deleted=${indexingResult.deleted?.join(",") || "none"}, cleanupErrors=${
          indexingResult.cleanupErrors?.join(";") || "none"
        }, sourceStillExists=${sourceStillExists}`
      }`,
    );

    await page.goto(`${baseUrl}/team`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Name").fill("QA Editor");
    await page.getByPlaceholder("user@example.com").fill("qa-editor@example.com");
    await page.getByPlaceholder("Initiales Passwort").fill("ChangeMe123!");
    await page.getByRole("button", { name: "Benutzer speichern" }).click();
    await waitForText(page, "Benutzer angelegt.");
    await waitForText(page, "qa-editor@example.com");
    checks.push(["Team page can create a user", true]);

    await page.getByPlaceholder("invite@example.com").fill("qa-invite@example.com");
    await page.getByRole("button", { name: "Einladungslink erzeugen" }).click();
    await waitForText(page, "qa-invite@example.com");
    const teamText = await page.locator("body").innerText();
    const inviteVisible =
      teamText.includes("Letzter Einladungslink") || teamText.includes("Einladung erstellt");
    checks.push(["Invitation creation succeeds even if clipboard copy is unavailable", inviteVisible]);
    assert(inviteVisible, "Invitation creation did not produce visible success feedback");

    return checks;
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    await resetTeamServerState(browser);
    const teamChecks = await runTeamFlow(browser);

    for (const [label, passed] of teamChecks) {
      console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
