import { notFound } from "next/navigation";

import { TeamPageClient } from "@/src/components/team/team-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function TeamPage() {
  if (getRuntimeConfig().demoMode) {
    notFound();
  }

  return <TeamPageClient />;
}
