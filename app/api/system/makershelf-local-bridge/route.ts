import { bridgeInstallerResponse } from "@/src/lib/server/bridge/installer";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  return bridgeInstallerResponse();
}
