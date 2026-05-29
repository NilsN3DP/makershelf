import { NextResponse } from "next/server";

import { buildLicenseStatus } from "@/src/lib/license";

export async function GET() {
  return NextResponse.json(buildLicenseStatus());
}
