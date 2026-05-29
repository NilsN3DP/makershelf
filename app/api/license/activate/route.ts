import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyWithLicenseServer } from "@/src/lib/license";

const activateSchema = z.object({
  licenseKey: z.string().trim().min(8),
  tier: z.enum(["community", "commercial"]).optional(),
  instanceId: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = activateSchema.parse(await request.json());
    const result = await verifyWithLicenseServer(body);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, state: "invalid", error: "Lizenzdaten sind unvollständig.", issues: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, state: "invalid", error: error instanceof Error ? error.message : "Lizenz konnte nicht aktiviert werden." },
      { status: 500 },
    );
  }
}
