import { notFound } from "next/navigation";

import { ToolsPageClient } from "@/src/components/tools/tools-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function ToolsPage() {
  if (getRuntimeConfig().demoMode) {
    notFound();
  }

  return <ToolsPageClient />;
}
