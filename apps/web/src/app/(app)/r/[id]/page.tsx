import Link from "next/link";
import { notFound } from "next/navigation";
import type { Profile } from "@raven/shared";
import { locationMapsUrl } from "@raven/shared";
import { getRaven, getSessionProfile } from "@/lib/data";
import { timeAgo, timeLeft } from "@/lib/format";
import { RsvpButtons } from "@/components/RsvpButtons";
import { ReplyThread } from "@/components/ReplyThread";
import { RecallButton } from "@/components/RecallButton";
import { AttendeeList } from "@/components/AttendeeList";
import { Avatar } from "@/components/Avatar";
import { LocationIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function RavenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, raven] = await Promise.all([getSessionProfile(), getRaven(id)]);
  if (!session) return null;
  if (!raven) notFound();

  const isSender = raven.sender_id === session.userId;
  const me = raven.recipients.find((r) => r.recipient_id === session.userId) ?? null;
  const attending = raven.recipients.filter((r) => r.status === "in" || r.status === "late");
  const awaiting = raven.recipients.filter((r) => r.status === "pending");
  const declined = raven.recipients.filter((r) => r.status === "cant");
  const inThread = isSender || me?.status === "in" || me?.status === "late";
  const expired = new Date(raven.expires_at) <= new Date();

  // Every profile a realtime-delivered reply could possibly be from, so
  // ReplyThread can resolve an author's display name from the payload's raw
  // author_id without a second network round-trip.
  const participants: Record<string, Profile> = { [raven.sender.id]: raven.sender };
  for (const r of raven.recipients) {
    if (r.profile) participants[r.profile.id] = r.profile;
  }

  return (
    <div className="pt-4">
      <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back
      </Link>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          <Avatar profile={raven.sender} size="sm" />
          {isSender ? "You" : raven.sender.display_name}
          <span className="normal-case text-ink-faint">
            {timeAgo(raven.created_at)} · {timeLeft(raven.expires_at)}
          </span>
        </p>
        <h1 className="invitation mt-3 text-[1.75rem]">{raven.body}</h1>
        {raven.location ? (
          <a
            href={locationMapsUrl(raven.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-accent"
          >
            <LocationIcon className="size-4" />
            {raven.location}
          </a>
        ) : null}
        {raven.media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={raven.media_url}
            alt=""
            className="mt-4 max-h-96 w-full rounded-2xl border border-line object-cover"
          />
        ) : null}
      </div>

      {me && !expired ? (
        <div className="mt-6">
          <RsvpButtons ravenId={raven.id} current={me.status} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-2">
        <AttendeeList attendees={attending} viewerId={session.userId} />
        {isSender && (awaiting.length > 0 || declined.length > 0) ? (
          <p className="px-1 text-xs text-ink-faint">
            {[
              awaiting.length > 0 ? `${awaiting.length} haven't replied` : null,
              declined.length > 0 ? `${declined.length} can't make it` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      {inThread ? (
        <ReplyThread
          ravenId={raven.id}
          initialReplies={raven.replies}
          participants={participants}
          viewerId={session.userId}
          expired={expired}
        />
      ) : me && !expired ? (
        <p className="mt-8 text-sm text-ink-faint">Say you&apos;re in to join the chat.</p>
      ) : null}

      {isSender ? (
        <div className="mt-10">
          <RecallButton ravenId={raven.id} />
        </div>
      ) : null}
    </div>
  );
}
