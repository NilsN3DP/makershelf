import { type Prisma } from "@prisma/client";

export function parseNullableDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapSpool(
  spool: Prisma.FilamentSpoolGetPayload<{ include: { owner: true; createdBy: true } }>,
) {
  return {
    ...spool,
    ownerName: spool.owner?.name ?? null,
    createdByName: spool.createdBy.name,
  };
}
