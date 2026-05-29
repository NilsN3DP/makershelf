import { getResolvedSystemStatus } from "@/src/lib/server/system-status";
import { SetupWizard } from "@/src/components/setup/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const initialSystemStatus = await getResolvedSystemStatus();

  return <SetupWizard initialServerStatus={initialSystemStatus} />;
}
