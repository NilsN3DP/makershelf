import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;

  // All filament logs for this workspace
  const logs = await prisma.printerFarmFilamentLog.findMany({
    where: { workspaceId, ownerUserId: userId },
    include: { printer: { select: { id: true, name: true, model: true } } },
    orderBy: { loggedAt: "desc" },
  });

  // Aggregate totals
  const totalGrams = logs.reduce((s, l) => s + l.gramsUsed, 0);
  const totalEntries = logs.length;

  // Per-printer breakdown
  const printerMap = new Map<string, { id: string; name: string; model: string | null; totalGrams: number; entries: number }>();
  for (const log of logs) {
    const key = log.printerId;
    const existing = printerMap.get(key) ?? { id: log.printer.id, name: log.printer.name, model: log.printer.model, totalGrams: 0, entries: 0 };
    existing.totalGrams += log.gramsUsed;
    existing.entries++;
    printerMap.set(key, existing);
  }
  const perPrinter = [...printerMap.values()].sort((a, b) => b.totalGrams - a.totalGrams);

  // Per-material breakdown (case-insensitive grouping)
  const materialMap = new Map<string, { material: string; totalGrams: number; entries: number }>();
  for (const log of logs) {
    const mat = (log.materialName?.trim() || "Unknown").toUpperCase();
    const existing = materialMap.get(mat) ?? { material: log.materialName?.trim() || "Unknown", totalGrams: 0, entries: 0 };
    existing.totalGrams += log.gramsUsed;
    existing.entries++;
    materialMap.set(mat, existing);
  }
  const perMaterial = [...materialMap.values()].sort((a, b) => b.totalGrams - a.totalGrams);

  // Monthly usage (last 12 months)
  const now = new Date();
  const monthly: { month: string; totalGrams: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toISOString().slice(0, 7); // "2025-11"
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const grams = logs
      .filter((l) => new Date(l.loggedAt) >= start && new Date(l.loggedAt) <= end)
      .reduce((s, l) => s + l.gramsUsed, 0);
    monthly.push({ month: label, totalGrams: grams });
  }

  return NextResponse.json({ totalGrams, totalEntries, perPrinter, perMaterial, monthly });
}
