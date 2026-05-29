import { Prisma } from "@prisma/client";

import {
  createGuestSubmissionToken,
  isGuestSubmissionLinkActive,
  sanitizeGuestSubmissionLabel,
} from "@/src/lib/server/guest-submission-links-core.js";
import { prisma } from "@/src/lib/server/prisma";

export {
  createGuestSubmissionToken,
  isGuestSubmissionLinkActive,
  sanitizeGuestSubmissionLabel,
};

export type ActiveGuestSubmissionLink = Prisma.GuestProjectSubmissionLinkGetPayload<{
  include: { workspace: true };
}>;

export async function getActiveGuestSubmissionLink(token: string): Promise<ActiveGuestSubmissionLink | null> {
  const link = await prisma.guestProjectSubmissionLink.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!link || !isGuestSubmissionLinkActive(link)) {
    return null;
  }

  return link;
}

export function buildGuestSubmissionUrl(request: Request, token: string) {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/guest-submit/${token}`;
}
