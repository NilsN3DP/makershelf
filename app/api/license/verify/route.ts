import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const verifySchema = z.object({
  product: z.literal("makershelf"),
  version: z.string().trim().min(1),
  licenseKey: z.string().trim().min(8),
  tier: z.enum(["community", "commercial"]).optional(),
  instanceId: z.string().trim().optional(),
});

function addDays(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const body = verifySchema.parse(await request.json());
    const normalizedKey = body.licenseKey.toUpperCase();
    const tier =
      body.tier ??
      (normalizedKey.startsWith("MAKERSHELF-COM-") || normalizedKey.startsWith("MAKERSHELF-COM-")
        ? "commercial"
        : "community");

    if (
      tier === "commercial" &&
      !normalizedKey.startsWith("MAKERSHELF-COM-") &&
      !normalizedKey.startsWith("MAKERSHELF-COM-")
    ) {
      return NextResponse.json(
        { ok: false, tier, state: "invalid", message: "Commercial-Lizenzschlüssel ist ungültig." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      tier,
      state: "active",
      nextCheckAt: addDays(tier === "community" ? 183 : 30),
      message:
        tier === "community"
          ? "Community-Lizenz aktiv. Spätestens in sechs Monaten erneut prüfen."
          : "Commercial-Lizenz aktiv.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        state: "invalid",
        message: error instanceof Error ? error.message : "Lizenzprüfung fehlgeschlagen.",
      },
      { status: 400 },
    );
  }
}
