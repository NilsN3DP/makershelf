import { NextRequest, NextResponse } from "next/server";

import type { DesktopOpenTarget, PrintFile, SlicerApp, StorageMode } from "@/src/lib/makershelf-data";

type OpenFilesBody = {
  files: PrintFile[];
  filesData?: Array<number[] | undefined>;
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
    const body = (await request.json()) as OpenFilesBody;
    const { files, target } = body;

    if (!files?.length || !target) {
      return NextResponse.json({ error: "Dateien oder Zielprogramm fehlen." }, { status: 400 });
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
            : "Dateien konnten nicht geöffnet werden.",
      },
      { status: 500 },
    );
  }
}
