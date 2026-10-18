import Link from "next/link";
import type { InboxRaven } from "@/lib/data";
import { lifeElapsed, timeLeft } from "@/lib/format";
import { RsvpButtons } from "@/components/RsvpButtons";
import { Avatar } from "@/components/Avatar";
import { LocationIcon } from "@/components/icons";
import { RavenPhoto } from "@/components/RavenPhoto";

function attendingLine(raven: InboxRaven, viewerId: string): string | null {
  const attending = raven.recipients.filter(
    (r) => (r.status === "in" || r.status === "late") && r.recipient_id !== viewerId,
  );
  const names = attending.map((r) => {
    const name = r.profile?.display_name ?? "Someone";
    return r.status === "late" ? `${name} (late)` : name;
  });
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is in`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are in`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are in`;
}

function attendingProfiles(raven: InboxRaven, viewerId: string) {
  return raven.recipients
    .filter((r) => (r.status === "in" || r.status === "late") && r.recipient_id !== viewerId)
    .flatMap((r) => (r.profile ? [r.profile] : []));
}

export function RavenCard({ raven, viewerId }: { raven: InboxRaven; viewerId: string }) {
  const isSender = raven.sender_id === viewerId;
  const me = raven.recipients.find((r) => r.recipient_id === viewerId) ?? null;
  const whosIn = attendingLine(raven, viewerId);
  const whosInProfiles = attendingProfiles(raven, viewerId);
  const expired = new Date(raven.expires_at) <= new Date();
  const remaining = Math.max(0, 1 - lifeElapsed(raven.created_at, raven.expires_at));

  const awaiting = isSender
    ? raven.recipients.filter((r) => r.status === "pending").length
    : 0;
  const declined = isSender
    ? raven.recipients.filter((r) => r.status === "cant").length
    : 0;

  return (
    <article className="card-in relative overflow-hidden rounded-2xl border border-line bg-raised shadow-[0_1px_2px_rgba(26,25,23,0.04)]">
      <Link href={`/r/${raven.id}`} className="block px-5 pt-4 pb-3">
        <p className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide text-ink-soft">
          <span className="flex items-center gap-2">
            <Avatar profile={raven.sender} size="sm" />
            <span className="uppercase">{isSender ? "You" : raven.sender.display_name}</span>
          </span>
          <span className="text-ink-faint">{timeLeft(raven.expires_at)}</span>
        </p>
        <p className="invitation mt-2 text-[1.35rem] text-ink">{raven.body}</p>
        {raven.location ? (
          // Plain text here, not a link: the card is already one big link to
          // /r/[id], and a nested <a> inside it is invalid HTML — the actual
          // tap-out to Maps lives on the detail page instead.
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
            <LocationIcon className="size-4" />
            {raven.location}
          </p>
        ) : null}
        {raven.media_url ? (
          <RavenPhoto
            src={raven.media_url}
            className="mt-3 max-h-72 w-full rounded-xl border border-line object-cover"
          />
        ) : null}
        {whosIn ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {whosInProfiles.slice(0, 4).map((profile) => (
                <span key={profile.id} className="ring-2 ring-raised rounded-full">
                  <Avatar profile={profile} size="sm" />
                </span>
              ))}
            </div>
            <p className="text-sm font-medium text-going">{whosIn}</p>
          </div>
        ) : null}
        {isSender && (awaiting > 0 || declined > 0) ? (
          <p className="mt-1.5 text-sm text-ink-faint">
            {[
              awaiting > 0 ? `${awaiting} haven't replied` : null,
              declined > 0 ? `${declined} can't make it` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </Link>

      {me && !expired ? (
        <div className="px-5 pb-4">
          <RsvpButtons ravenId={raven.id} current={me.status} />
        </div>
      ) : (
        <div className="pb-3" />
      )}

      {/* the evaporation line — drains as the raven nears expiry */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-sunken">
        <div
          className="h-full rounded-r-full bg-accent/70"
          style={{ width: `${Math.round(remaining * 100)}%` }}
        />
      </div>
    </article>
  );
}
