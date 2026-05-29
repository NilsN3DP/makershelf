import { notFound } from "next/navigation";

import { LaserPageClient } from "@/src/components/laser/laser-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function LaserPage() {
  if (getRuntimeConfig().demoMode) notFound();
  return <LaserPageClient />;
}
