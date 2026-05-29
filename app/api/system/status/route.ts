import { NextResponse } from "next/server";

import { getResolvedSystemStatus } from "@/src/lib/server/system-status";

export async function GET() {
  try {
    return NextResponse.json(await getResolvedSystemStatus());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "System status unavailable.",
      },
      { status: 500 },
    );
  }
}
