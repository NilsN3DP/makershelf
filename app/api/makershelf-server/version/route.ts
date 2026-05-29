import packageJson from "@/package.json";

type VersionPageLanguage = "de" | "en";

function html(strings: TemplateStringsArray, ...values: string[]) {
  return String.raw({ raw: strings }, ...values);
}

function baseOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost || request.headers.get("host");
  const proto = forwardedProto || url.protocol.replace(/:$/, "");

  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("[::]")) {
    return `${proto}://${host}`;
  }

  const publicBaseUrl = process.env.MAKERSHELF_PUBLIC_BASE_URL?.trim();
  if (publicBaseUrl) {
    return publicBaseUrl.replace(/\/$/, "");
  }

  return url.origin;
}

function languageLinks(origin: string, activeLanguage: VersionPageLanguage) {
  const deClass = activeLanguage === "de" ? "button" : "button secondary";
  const enClass = activeLanguage === "en" ? "button" : "button secondary";

  return html`<nav class="language-switch" aria-label="Language">
    <a class="${deClass}" href="${origin}/api/makershelf-server/version/de">Deutsch</a>
    <a class="${enClass}" href="${origin}/api/makershelf-server/version/en">English</a>
  </nav>`;
}

export function renderVersionPage(request: Request, language: VersionPageLanguage = "de") {
  const version = packageJson.version;
  const releaseTag = `v${version}`;
  const releaseUrl = `https://github.com/NilsN3DP/makershelf-releases/releases/tag/${releaseTag}`;
  const origin = baseOrigin(request);
  const installShUrl = `${origin}/api/makershelf-server/install/sh`;
  const installPs1Url = `${origin}/api/makershelf-server/install/ps1`;
  const coffeeUrl = "https://buymeacoffee.com/n3dp";
  const isGerman = language === "de";

  const copy = isGerman
    ? {
        lang: "de",
        title: `makershelf Server Beta ${version}`,
        intro:
          "Beta-Infoseite für Tester. Der GitHub Release bleibt bewusst kurz; die nötigen Setup-Hinweise stehen hier.",
        release: "Release öffnen",
        coffee: "Kaffee ausgeben",
        fixedTagText: `Für einen festen Stand kann statt <code>beta</code> der Tag <code>${releaseTag}</code> verwendet werden.`,
        oneCommand: "Ein-Befehl Installation",
        oneCommandText:
          "Der Befehl installiert den kompletten Stack: makershelf Server, PostgreSQL, Compose-Datei, .env und persistente Docker Volumes.",
        fixedCommand: "Fester Beta-Stand statt beweglichem",
        requirements: "Voraussetzungen",
        reqDocker: "Docker, Docker Desktop oder Unraid",
        reqPort: "Freier Port 3000 auf dem Zielsystem",
        reqBackup: "Backup vor Updates",
        unraidInstall: "Unraid Installation",
        unraidInstallText:
          "Auf Unraid im WebUI ein Terminal öffnen. Der Befehl legt Compose-Datei, .env und Daten unter",
        openAfter: "Danach im Browser öffnen:",
        unraidPortText:
          "Wenn Port 3000 schon belegt ist, vor dem Installieren z.B. MAKERSHELF_PORT=3017 setzen. Optional kann mit MAKERSHELF_BIND_IP=192.168.1.50 gezielt an eine Unraid-IP gebunden werden.",
        editValues: "Unraid Werte Ändern",
        editValuesText:
          "Die installierten Werte stehen in /mnt/user/appdata/makershelf-server/.env. Nach einer Änderung den Stack neu erstellen.",
        externalPort: "externer Port, z.B.",
        bindIp: "optionale feste Unraid-IP, leer lassen für alle Interfaces",
        portBinding: "Docker-Portbindung, z.B.",
        imageTag: "Image-Tag, z.B.",
        volumePaths: "Appdata-Pfade für Datenbank, Konfiguration, Storage und Import",
        created: "Was Angelegt Wird",
        folder: "Ordner",
        folderSuffix: "mit",
        containers: "Container",
        and: "und",
        volumes: "Volumes oder Appdata-Ordner für Datenbank, Konfiguration, Storage und Import",
        setupAfter: "Setup danach öffnen:",
        update: "Unraid Update",
        updateText:
          "Bei einem festen Release-Stand vorher in der .env den Wert MAKERSHELF_IMAGE auf den gewünschten Tag setzen. Für automatische Beta-Updates ghcr.io/nilsn3dp/makershelf-server:beta verwenden.",
        newInBeta: "Neu In Dieser Beta",
        changeImage: "Server-only Beta Image",
        changeBridge: "Windows Bridge repariert",
        changeMulti: "Mehrfachauswahl öffnet Dateien in einem Slicer-Start",
        changePrusa: "PrusaSlicer Mehrfachimport nutzt",
      }
    : {
        lang: "en",
        title: `makershelf Server Beta ${version}`,
        intro:
          "Beta info page for testers. The GitHub release stays intentionally short; the required setup notes are here.",
        release: "Open release",
        coffee: "Buy me a coffee",
        fixedTagText: `For a fixed build, use tag <code>${releaseTag}</code> instead of <code>beta</code>.`,
        oneCommand: "One-command installation",
        oneCommandText:
          "This command installs the full stack: makershelf Server, PostgreSQL, compose file, .env and persistent Docker volumes.",
        fixedCommand: "Fixed beta build instead of moving",
        requirements: "Requirements",
        reqDocker: "Docker, Docker Desktop or Unraid",
        reqPort: "Free port 3000 on the target system",
        reqBackup: "Backup before updates",
        unraidInstall: "Unraid installation",
        unraidInstallText:
          "Open a terminal in the Unraid web UI. This command stores the compose file, .env and data under",
        openAfter: "Then open in your browser:",
        unraidPortText:
          "If port 3000 is already in use, set MAKERSHELF_PORT=3017 before installing. Optionally set MAKERSHELF_BIND_IP=192.168.1.50 to bind to a specific Unraid IP.",
        editValues: "Change Unraid values",
        editValuesText:
          "Installed values are stored in /mnt/user/appdata/makershelf-server/.env. Recreate the stack after changing them.",
        externalPort: "external port, e.g.",
        bindIp: "optional fixed Unraid IP, leave empty for all interfaces",
        portBinding: "Docker port binding, e.g.",
        imageTag: "image tag, e.g.",
        volumePaths: "Appdata paths for database, configuration, storage and import",
        created: "What Gets Created",
        folder: "Folder",
        folderSuffix: "with",
        containers: "Containers",
        and: "and",
        volumes: "Volumes or Appdata folders for database, configuration, storage and import",
        setupAfter: "Open setup afterwards:",
        update: "Unraid update",
        updateText:
          "For a fixed release build, first set MAKERSHELF_IMAGE in .env to the desired tag. Use ghcr.io/nilsn3dp/makershelf-server:beta for automatic beta updates.",
        newInBeta: "New In This Beta",
        changeImage: "Server-only beta image",
        changeBridge: "Windows Bridge fixed",
        changeMulti: "Multi-selection opens files in one slicer launch",
        changePrusa: "PrusaSlicer multi-import uses",
      };

  return new Response(
    html`<!doctype html>
<html lang="${copy.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${copy.title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --panel: #0d1b2e;
      --border: #20354f;
      --text: #f7fbff;
      --muted: #a9bad0;
      --accent: #ff7a1a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
    }
    main {
      width: min(920px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 64px;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 28px;
      margin-bottom: 28px;
    }
    .language-switch {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 28px;
    }
    .eyebrow {
      color: var(--accent);
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0;
      margin-bottom: 8px;
    }
    h1 {
      font-size: clamp(34px, 6vw, 58px);
      line-height: 1;
      margin: 0 0 12px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 18px;
      margin: 0 0 14px;
    }
    p { color: var(--muted); margin: 0; }
    code {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 6px;
      background: #14243a;
      color: #fff;
    }
    pre {
      margin: 12px 0 0;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow-x: auto;
      background: #050c16;
      color: #f7fbff;
    }
    section {
      padding: 22px 0;
      border-bottom: 1px solid var(--border);
    }
    ul, ol { margin: 0; padding-left: 22px; color: var(--muted); }
    li + li { margin-top: 8px; }
    a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 700;
    }
    a:hover { text-decoration: underline; }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      padding: 0 16px;
      border-radius: 8px;
      background: var(--accent);
      color: #111;
      text-decoration: none;
      font-weight: 800;
    }
    .button.secondary {
      background: var(--panel);
      color: var(--text);
      border: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <main>
    ${languageLinks(origin, language)}
    <header>
      <div class="eyebrow">Public Beta · Server Docker Image</div>
      <h1>makershelf Server ${version}</h1>
      <p>${copy.intro}</p>
      <div class="actions">
        <a class="button" href="${releaseUrl}">${copy.release}</a>
        <a class="button secondary" href="${coffeeUrl}" target="_blank" rel="noreferrer">${copy.coffee}</a>
        <a class="button secondary" href="/api/health">Healthcheck</a>
        <a class="button secondary" href="/api/makershelf-server/install/sh">install.sh</a>
        <a class="button secondary" href="/api/makershelf-server/install/ps1">install.ps1</a>
      </div>
    </header>

    <section>
      <h2>Image</h2>
      <pre>ghcr.io/nilsn3dp/makershelf-server:beta</pre>
      <p>${copy.fixedTagText}</p>
    </section>

    <section>
      <h2>${copy.oneCommand}</h2>
      <p>${copy.oneCommandText}</p>
      <pre>curl -fsSL ${installShUrl} | bash</pre>
      <p>Windows PowerShell:</p>
      <pre>irm ${installPs1Url} | iex</pre>
      <p>${copy.fixedCommand} <code>beta</code> tag:</p>
      <pre>MAKERSHELF_IMAGE_TAG=${releaseTag} curl -fsSL ${installShUrl} | bash</pre>
    </section>

    <section>
      <h2>${copy.requirements}</h2>
      <ul>
        <li>${copy.reqDocker}</li>
        <li>${copy.reqPort}</li>
        <li>${copy.reqBackup}</li>
      </ul>
    </section>

    <section>
      <h2>${copy.unraidInstall}</h2>
      <p>${copy.unraidInstallText} <code>/mnt/user/appdata/makershelf-server</code>.</p>
      <pre>MAKERSHELF_DIR=/mnt/user/appdata/makershelf-server \
MAKERSHELF_DATA_DIR=/mnt/user/appdata/makershelf-server/data \
MAKERSHELF_PORT=3000 \
curl -fsSL ${installShUrl} | bash</pre>
      <p>${copy.openAfter}</p>
      <pre>http://&lt;unraid-ip&gt;:3000/setup</pre>
      <p>${copy.unraidPortText}</p>
    </section>

    <section>
      <h2>${copy.editValues}</h2>
      <p>${copy.editValuesText}</p>
      <pre>nano /mnt/user/appdata/makershelf-server/.env
cd /mnt/user/appdata/makershelf-server
docker compose up -d</pre>
      <ul>
        <li><code>MAKERSHELF_PORT</code>: ${copy.externalPort} <code>3017</code></li>
        <li><code>MAKERSHELF_BIND_IP</code>: ${copy.bindIp}</li>
        <li><code>MAKERSHELF_PORT_BINDING</code>: ${copy.portBinding} <code>192.168.1.50:3017:3000</code></li>
        <li><code>MAKERSHELF_IMAGE</code>: ${copy.imageTag} <code>ghcr.io/nilsn3dp/makershelf-server:${releaseTag}</code></li>
        <li><code>MAKERSHELF_*_VOLUME</code>: ${copy.volumePaths}</li>
      </ul>
    </section>

    <section>
      <h2>${copy.created}</h2>
      <ol>
        <li>${copy.folder} <code>makershelf-server</code> ${copy.folderSuffix} <code>.env</code> und <code>compose.yml</code></li>
        <li>${copy.containers} <code>makershelf-server</code> ${copy.and} <code>makershelf-postgres</code></li>
        <li>${copy.volumes}</li>
        <li>${copy.setupAfter} <code>http://&lt;server-ip&gt;:3000/setup</code></li>
      </ol>
    </section>

    <section>
      <h2>${copy.update}</h2>
      <pre>cd /mnt/user/appdata/makershelf-server
docker compose pull
docker compose up -d</pre>
      <p>${copy.updateText}</p>
    </section>

    <section>
      <h2>${copy.newInBeta}</h2>
      <ul>
        <li>${copy.changeImage}</li>
        <li>${copy.changeBridge}</li>
        <li>${copy.changeMulti}</li>
        <li>${copy.changePrusa} <code>--merge</code></li>
      </ul>
    </section>
  </main>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(request: Request) {
  return renderVersionPage(request, "de");
}
