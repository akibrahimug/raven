import { Suspense } from "react";
import { getInbox, getSessionProfile } from "@/lib/data";
import { InboxTabs } from "@/components/InboxTabs";
import { InboxSkeleton } from "@/components/Skeleton";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const sent = tab === "sent";
  return (
    <Suspense fallback={<InboxSkeleton sent={sent} />}>
      <Inbox initialSent={sent} />
    </Suspense>
  );
}

async function Inbox({ initialSent }: { initialSent: boolean }) {
  const [session, ravens] = await Promise.all([getSessionProfile(), getInbox()]);
  if (!session) return null;
  return <InboxTabs ravens={ravens} viewerId={session.userId} initialSent={initialSent} />;
}
