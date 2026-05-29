import { notFound } from "next/navigation";

import { GuestProjectSubmissionPage } from "@/src/components/projects/guest-project-submission-page";
import { getActiveGuestSubmissionLink } from "@/src/lib/server/guest-submission-links";

type GuestSubmitPageProps = {
  params: Promise<{ token: string }>;
};

export default async function GuestSubmitPage({ params }: GuestSubmitPageProps) {
  const { token } = await params;
  const link = await getActiveGuestSubmissionLink(token);

  if (!link) {
    notFound();
  }

  return (
    <GuestProjectSubmissionPage
      token={token}
      label={link.label}
      workspaceName={link.workspace.name}
    />
  );
}
