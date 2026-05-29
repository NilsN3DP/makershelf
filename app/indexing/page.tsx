import { notFound } from "next/navigation";

import { IndexingPageClient } from "@/src/components/indexing/indexing-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function IndexingPage() {
  if (getRuntimeConfig().demoMode) {
    notFound();
  }

  return <IndexingPageClient />;
}
