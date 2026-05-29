import { notFound } from "next/navigation";

import { SpoolmanPageClient } from "@/src/components/spoolman/spoolman-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function SpoolmanPage() {
  if (getRuntimeConfig().demoMode) {
    notFound();
  }

  return <SpoolmanPageClient />;
}
