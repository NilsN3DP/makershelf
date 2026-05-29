import { NextResponse } from "next/server";

import { getSessionFromCookieStore } from "@/src/lib/server/auth/session";
import { getWorkspaceSnapshotData } from "@/src/lib/server/queries";
import { mapWorkspaceToSnapshot } from "@/src/lib/server/snapshot";
import { createSnapshotNoStoreHeaders } from "@/src/lib/snapshot-cache-core.mjs";

export async function GET() {
  const session = await getSessionFromCookieStore();
  if (!session) {
    return NextResponse.json(
      { error: "Nicht angemeldet." },
      { status: 401, headers: createSnapshotNoStoreHeaders() },
    );
  }

  const membership = session.user.memberships[0];
  if (!membership) {
    return NextResponse.json(
      { error: "Kein Workspace zugeordnet." },
      { status: 403, headers: createSnapshotNoStoreHeaders() },
    );
  }

  const workspace = await getWorkspaceSnapshotData(membership.workspaceId);
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace nicht gefunden." },
      { status: 404, headers: createSnapshotNoStoreHeaders() },
    );
  }

  return NextResponse.json(mapWorkspaceToSnapshot(workspace), {
    headers: createSnapshotNoStoreHeaders(),
  });
}
