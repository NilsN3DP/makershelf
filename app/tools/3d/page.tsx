import { notFound } from "next/navigation";

import { Tools3DPageClient } from "@/src/components/tools/tools-3d-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function Tools3DPage() {
  if (getRuntimeConfig().demoMode) notFound();
  return <Tools3DPageClient />;
}
