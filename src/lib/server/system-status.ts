import { getServerEnv } from "@/src/lib/server/env";
import { prisma } from "@/src/lib/server/prisma";

export type ResolvedSystemStatus = {
  ok: true;
  appName: string;
  multiUserEnabled: boolean;
  dataBackend: string;
  storageDriver: string;
  databaseProvider: string;
  bootstrapRequired: boolean;
  workspaceCount: number;
  userCount: number;
};

export async function getResolvedSystemStatus(): Promise<ResolvedSystemStatus> {
  const env = getServerEnv();
  const [workspaceCount, userCount, workspace] = await Promise.all([
    prisma.workspace.count(),
    prisma.user.count(),
    prisma.workspace.findFirst({ select: { settingsJson: true } }),
  ]);

  const settingsJson =
    workspace?.settingsJson && typeof workspace.settingsJson === "object"
      ? (workspace.settingsJson as Record<string, unknown>)
      : {};
  const multiUserEnabledRaw = settingsJson.multiUserEnabled;
  const multiUserEnabled =
    typeof multiUserEnabledRaw === "boolean" ? multiUserEnabledRaw : userCount > 1;

  return {
    ok: true,
    appName: env.MAKERSHELF_APP_NAME,
    multiUserEnabled,
    dataBackend: env.MAKERSHELF_DATA_BACKEND === "browser" ? "postgres" : env.MAKERSHELF_DATA_BACKEND,
    storageDriver: "filesystem",
    databaseProvider: env.DATABASE_PROVIDER,
    bootstrapRequired: userCount === 0,
    workspaceCount,
    userCount,
  };
}
