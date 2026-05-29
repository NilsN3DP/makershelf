const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let mainWindow = null;
let serverProcess = null;
let serverPort = null;

function resolveAppRoot() {
  return app.getAppPath();
}

function resolveStandaloneRoot() {
  return path.join(resolveAppRoot(), "desktop-app", ".next", "standalone");
}

function resolveWindowIcon() {
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  return path.join(resolveAppRoot(), "build", iconFile);
}

function resolveTemplateDb() {
  return path.join(resolveAppRoot(), "prisma", "dev.single.template.db");
}

function resolveWritablePaths() {
  const userDataRoot = app.getPath("userData");
  const databaseDir = path.join(userDataRoot, "prisma");
  const databasePath = path.join(databaseDir, "desktop.single.db");
  const storageRoot = path.join(app.getPath("documents"), "makershelf");

  return {
    databaseDir,
    databasePath,
    storageRoot,
  };
}

function ensureDesktopStorage() {
  const { databaseDir, databasePath, storageRoot } = resolveWritablePaths();
  fs.mkdirSync(databaseDir, { recursive: true });
  fs.mkdirSync(storageRoot, { recursive: true });

  if (!fs.existsSync(databasePath)) {
    const templatePath = resolveTemplateDb();
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Missing desktop SQLite template: ${templatePath}`);
    }

    fs.copyFileSync(templatePath, databasePath);
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to determine free port.")));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function waitForServer(port) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const attempt = () => {
      const request = http.get(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/health",
          timeout: 3000,
        },
        (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
            resolve();
            return;
          }

          if (Date.now() - start > 30000) {
            reject(new Error("Desktop app server did not become ready in time."));
            return;
          }

          setTimeout(attempt, 500);
        },
      );

      request.on("error", () => {
        if (Date.now() - start > 30000) {
          reject(new Error("Desktop app server did not become ready in time."));
          return;
        }

        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

async function startBundledServer() {
  if (serverProcess) {
    return;
  }

  ensureDesktopStorage();
  serverPort = await getFreePort();

  const { databasePath, storageRoot } = resolveWritablePaths();
  const standaloneRoot = resolveStandaloneRoot();
  const serverEntry = path.join(standaloneRoot, "server.js");

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Bundled server entry not found: ${serverEntry}`);
  }

  const databaseUrl = `file:${databasePath.replace(/\\/g, "/")}`;
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(serverPort),
      DATABASE_URL: databaseUrl,
      MAKERSHELF_PRODUCT_PROFILE: "single",
      MAKERSHELF_DEPLOYMENT_MODE: "single-user",
      MAKERSHELF_DATA_BACKEND: "browser",
      MAKERSHELF_STORAGE_DRIVER: "filesystem",
      MAKERSHELF_STORAGE_ROOT: storageRoot,
      MAKERSHELF_APP_NAME: "makershelf Single",
      MAKERSHELF_LICENSE_TIER: "community",
      MAKERSHELF_LICENSE_KEY: "MAKERSHELF-COMMUNITY-desktop",
    },
    stdio: "ignore",
    windowsHide: true,
  });

  serverProcess.once("exit", () => {
    serverProcess = null;
  });

  await waitForServer(serverPort);
}

async function createMainWindow() {
  await startBundledServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    icon: resolveWindowIcon(),
    backgroundColor: "#09111c",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(resolveAppRoot(), "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
}

function stopBundledServer() {
  if (!serverProcess) {
    return;
  }

  serverProcess.kill();
  serverProcess = null;
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBundledServer();
});
