import Link from "next/link";
import { getInbox, getSessionProfile } from "@/lib/data";
import { RavenCard } from "@/components/RavenCard";
import { RavenMark } from "@/components/RavenMark";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [session, { tab }] = await Promise.all([getSessionProfile(), searchParams]);
  if (!session) return null;
  const sent = tab === "sent";
  const all = await getInbox();
  const ravens = all.filter((raven) =>
    sent ? raven.sender_id === session.userId : raven.sender_id !== session.userId,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit rounded-full border border-line bg-raised p-1">
        <Link
          href="/"
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !sent ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          For you
        </Link>
        <Link
          href="/?tab=sent"
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            sent ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          Sent
        </Link>
      </div>

      {ravens.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-20 text-center">
          <RavenMark className="size-16 text-ink-faint" />
          <p className="invitation text-2xl text-ink-soft">
            {sent ? "You haven't sent one yet." : "The sky is clear."}
          </p>
          <p className="max-w-[26ch] text-sm text-ink-faint">
            {sent
              ? "Tap Send a Raven whenever you're up to something."
              : "When a friend is up to something, it'll land here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {ravens.map((raven) => (
            <RavenCard key={raven.id} raven={raven} viewerId={session.userId} />
          ))}
        </div>
      )}
    </div>
  );
}
