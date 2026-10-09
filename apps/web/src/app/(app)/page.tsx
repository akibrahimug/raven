import { getInbox, getSessionProfile } from "@/lib/data";
import { InboxTabs } from "@/components/InboxTabs";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [session, { tab }, ravens] = await Promise.all([
    getSessionProfile(),
    searchParams,
    getInbox(),
  ]);
  if (!session) return null;

  return <InboxTabs ravens={ravens} viewerId={session.userId} initialSent={tab === "sent"} />;
}
