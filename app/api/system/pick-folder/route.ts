import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { NextRequest, NextResponse } from "next/server";

import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const PICKER_PREFIX = "makershelf-folder-picker-";
const WINDOWS_POWERSHELL =
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

function getPickerFilePath(sessionId: string) {
  return path.join(os.tmpdir(), `${PICKER_PREFIX}${sessionId}.json`);
}

function getPickerScriptPath(sessionId: string) {
  return path.join(os.tmpdir(), `${PICKER_PREFIX}${sessionId}.ps1`);
}

function makeSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readPickerState(sessionId: string) {
  const filePath = getPickerFilePath(sessionId);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) {
      return { state: "pending" as const };
    }
    return JSON.parse(raw) as {
      state: "pending" | "selected" | "canceled" | "error";
      path?: string;
      error?: string;
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writePickerState(
  sessionId: string,
  state: {
    state: "pending" | "selected" | "canceled" | "error";
    path?: string;
    error?: string;
  },
) {
  await fs.writeFile(getPickerFilePath(sessionId), JSON.stringify(state), "utf8");
}

export async function POST() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  try {
    if (process.platform !== "win32") {
      return NextResponse.json(
        { error: "Native Ordnerauswahl ist hier nicht verfügbar." },
        { status: 501 },
      );
    }

    const sessionId = makeSessionId();
    const pickerFilePath = getPickerFilePath(sessionId);
    const pickerScriptPath = getPickerScriptPath(sessionId);

    await fs.writeFile(pickerFilePath, JSON.stringify({ state: "pending" }), "utf8");

    const escapedPickerFilePath = pickerFilePath.replace(/'/g, "''");
    const powerShellScript = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
$targetFile = '${escapedPickerFilePath}'
$tempFile = "$targetFile.tmp"
try {
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = 'makershelf Projektordner waehlen'
  $dialog.ValidateNames = $false
  $dialog.CheckFileExists = $false
  $dialog.CheckPathExists = $true
  $dialog.FileName = 'Diesen Ordner auswaehlen'
  $dialog.Filter = 'Ordnerauswahl|*.folder'
  $result = $dialog.ShowDialog()
  if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    $selectedPath = Split-Path -Parent $dialog.FileName
    $payload = @{ state = 'selected'; path = $selectedPath } | ConvertTo-Json -Compress
  } else {
    $payload = @{ state = 'canceled' } | ConvertTo-Json -Compress
  }
} catch {
  $payload = @{ state = 'error'; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
[System.IO.File]::WriteAllText($tempFile, $payload, [System.Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $tempFile -Destination $targetFile -Force
`.trim();

    await fs.writeFile(pickerScriptPath, powerShellScript, "utf8");

    const child = spawn(
      "cmd.exe",
      [
        "/c",
        "start",
        "",
        WINDOWS_POWERSHELL,
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        pickerScriptPath,
      ],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      },
    );

    child.once("error", (error) => {
      void writePickerState(sessionId, {
        state: "error",
        error: error.message,
      });
    });

    child.unref();

    return NextResponse.json({ sessionId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ordnerauswahl konnte nicht gestartet werden.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;

  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId fehlt." }, { status: 400 });
    }

    const state = await readPickerState(sessionId);
    if (!state) {
      return NextResponse.json({ state: "pending" });
    }

    if (state.state === "selected" || state.state === "canceled" || state.state === "error") {
      try {
        await fs.unlink(getPickerFilePath(sessionId));
      } catch {
        // Ignore cleanup issues.
      }
      try {
        await fs.unlink(getPickerScriptPath(sessionId));
      } catch {
        // Ignore cleanup issues.
      }
    }

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        state: "error",
        error:
          error instanceof Error
            ? error.message
            : "Ordnerauswahl konnte nicht gelesen werden.",
      },
      { status: 500 },
    );
  }
}
