import { notFound } from "next/navigation";

import { DuplicatesPageClient } from "@/src/components/duplicates/duplicates-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function DuplicatesPage() {
  if (getRuntimeConfig().demoMode) {
    notFound();
  }

  return <DuplicatesPageClient />;
}
