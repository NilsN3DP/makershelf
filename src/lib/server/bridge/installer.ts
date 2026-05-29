import { promises as fs } from "node:fs";
import path from "node:path";

export async function buildBridgeInstaller(): Promise<string> {
  const bridgeDir = path.join(process.cwd(), "src", "lib", "server", "bridge");
  const [handler, installerTemplate] = await Promise.all([
    fs.readFile(path.join(bridgeDir, "handler.ps1"), "utf-8"),
    fs.readFile(path.join(bridgeDir, "installer-template.ps1"), "utf-8"),
  ]);

  // The handler is embedded in a single-quoted PowerShell here-string, so variables
  // must stay untouched. Escaping "$" would write invalid handler syntax to disk.
  return installerTemplate.replace("HANDLER_PLACEHOLDER", handler);
}

export async function bridgeInstallerResponse(): Promise<Response> {
  try {
    const content = await buildBridgeInstaller();
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="install-makershelf-bridge.ps1"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[makershelf-bridge] Bridge-Dateien nicht gefunden:", error);
    return new Response("Bridge-Installationsdateien nicht verfügbar.", { status: 500 });
  }
}
