import { NextResponse } from "next/server";

import packageJson from "@/package.json";
import { prisma } from "@/src/lib/server/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        service: "makershelf",
        version: packageJson.version,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "makershelf",
        version: packageJson.version,
        error: error instanceof Error ? error.message : "Health check failed.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
