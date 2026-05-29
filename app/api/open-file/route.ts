import { NextRequest, NextResponse } from "next/server";

import type { DesktopOpenTarget, PrintFile, SlicerApp, StorageMode } from "@/src/lib/makershelf-data";

type OpenFileBody = {
  file?: PrintFile;
  fileData?: number[];
  fileMimeType?: string;
  target?: DesktopOpenTarget;
  preferredSlicer?: SlicerApp;
  storageMode?: StorageMode;
  storagePath?: string;
  slicerExePaths?: Record<SlicerApp, string>;
  fusion360ExePath?: string;
  freecadExePath?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OpenFileBody;
    const file = body.file;
    const target = body.target;

    if (!file || !target) {
      return NextResponse.json({ error: "Datei oder Zielprogramm fehlt." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          "Lokale Programme öffnen funktioniert direkt nur in der Desktop-App. Im Server-Modus nutze bitte in der Weboberfläche die makershelf Bridge-Einrichtung; der Server kann keine Programme auf deinem Computer starten.",
      },
      { status: 422 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Datei konnte nicht in der Desktop-Anwendung geöffnet werden.",
      },
      { status: 500 },
    );
  }
}
