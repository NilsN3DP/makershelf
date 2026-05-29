import { notFound } from "next/navigation";

import { PrinterFarmPageClient } from "@/src/components/printer-farm/printer-farm-page-client";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

export const dynamic = "force-dynamic";

export default function PrinterFarmPage() {
  if (getRuntimeConfig().demoMode) notFound();
  return <PrinterFarmPageClient />;
}
