import { NextRequest, NextResponse } from "next/server";

import { scanImportFolderSummaries, scanImportRoot } from "@/src/lib/server/import-root";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export async function GET(request: NextRequest) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) {
    return access.response;
  }

  if (access.permissions.isReadOnly || !access.permissions.canUpload) {
    return NextResponse.json({ error: "Keine Upload-Berechtigung." }, { status: 403 });
  }

  const scanMode = request.nextUrl.searchParams.get("mode");
  const rootPaths = request.nextUrl.searchParams.getAll("rootPath");

  if (request.nextUrl.searchParams.get("stream") === "1") {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        let lastProgressAt = 0;
        let lastMatchedCount = -1;
        const onProgress = (progress: {
          currentPath: string;
          entriesVisited: number;
          directoriesVisited: number;
          filesMatched: number;
        }) => {
          const now = Date.now();
          const hitMatchedMilestone =
            progress.filesMatched > 0 &&
            progress.filesMatched % 25 === 0 &&
            progress.filesMatched !== lastMatchedCount;

          if (now - lastProgressAt < 200 && !hitMatchedMilestone) {
            return;
          }
          lastProgressAt = now;
          lastMatchedCount = progress.filesMatched;
          send({
            type: "progress",
            ...progress,
          });
        };

        try {
          const result =
            scanMode === "folders"
              ? await scanImportFolderSummaries({ rootPaths, onProgress })
              : await scanImportRoot({ rootPaths, onProgress });

          send({
            type: "complete",
            importRoot: result.root,
            ...result,
          });
        } catch (error) {
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Import-Ordner konnte nicht gelesen werden.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  }

  const result =
    scanMode === "folders"
      ? await scanImportFolderSummaries({ rootPaths })
      : await scanImportRoot({ rootPaths });
  return NextResponse.json({
    importRoot: result.root,
    ...result,
  });
}
