import { NextResponse } from "next/server";
import { z } from "zod";

import { bootstrapWorkspaceWithAdmin } from "@/src/lib/server/bootstrap";

const bootstrapSchema = z.object({
  workspaceName: z.string().min(2).max(120),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(256),
  filamentVaultEnabled: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bootstrapSchema.parse(await request.json());
    const result = await bootstrapWorkspaceWithAdmin(body);

    return NextResponse.json({
      ok: true,
      message: "Initial workspace and admin user created.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Bootstrap failed.",
      },
      { status: 400 },
    );
  }
}
