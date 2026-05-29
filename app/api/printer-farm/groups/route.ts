import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/server/prisma";
import { requireWorkspaceAccess } from "@/src/lib/server/request-context";

const groupSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#6366f1"),
  sortOrder: z.number().int().optional().default(0),
});

export async function GET() {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;

  const groups = await prisma.printerFarmGroup.findMany({
    where: { workspaceId, ownerUserId: userId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { printers: true } } },
  });

  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const access = await requireWorkspaceAccess();
  if (!access.ok) return access.response;
  const { workspaceId, userId } = access.membership;

  const body = await request.json().catch(() => null);
  const parsed = groupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });

  const group = await prisma.printerFarmGroup.create({
    data: { ...parsed.data, workspaceId, ownerUserId: userId },
  });
  return NextResponse.json(group, { status: 201 });
}
