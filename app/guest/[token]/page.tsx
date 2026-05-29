import { notFound } from "next/navigation";

import { GuestProjectPage } from "@/src/components/projects/guest-project-page";
import { getGuestProjectByToken } from "@/src/lib/server/guest-links";

type GuestPageProps = {
  params: Promise<{ token: string }>;
};

export default async function GuestPage({ params }: GuestPageProps) {
  const { token } = await params;
  const result = await getGuestProjectByToken(token);

  if (!result) {
    notFound();
  }

  return <GuestProjectPage project={result.project} token={token} />;
}
