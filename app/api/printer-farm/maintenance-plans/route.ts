import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

/**
 * GET /api/printer-farm/maintenance-plans
 *
 * Returns all active maintenance plans workspace-wide, annotated with
 * daysUntilDue (negative = overdue). Primarily used for in-app notifications.
 */
export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;

  const now = new Date();

  const plans = await prisma.printerFarmMaintenancePlan.findMany({
    where: { workspaceId, ownerUserId: userId, active: true },
    include: {
      printer: { select: { id: true, name: true, model: true, isDummy: true } },
    },
    orderBy: { nextDueAt: "asc" },
  });

  const annotated = plans.map((plan) => {
    const daysUntilDue = plan.nextDueAt
      ? Math.floor((plan.nextDueAt.getTime() - now.getTime()) / 86400000)
      : null;
    return { ...plan, daysUntilDue };
  });

  return NextResponse.json({ plans: annotated });
}
