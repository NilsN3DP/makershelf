import { notFound } from "next/navigation";

import { DevPageClient } from "@/src/components/dev/dev-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function DevPage() {
  if (getRuntimeConfig().demoMode) {
    notFound();
  }

  return <DevPageClient />;
}
