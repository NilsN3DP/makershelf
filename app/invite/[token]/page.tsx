import { InviteAcceptPageClient } from "@/src/components/team/invite-accept-page-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteAcceptPageClient token={token} />;
}
