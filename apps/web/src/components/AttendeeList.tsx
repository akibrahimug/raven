import type { Profile, RavenRecipient } from "@raven/shared";
import { Avatar } from "@/components/Avatar";

/** Who's coming: avatar, name, and a status chip — not a sentence. */
export function AttendeeList({
  attendees,
  viewerId,
}: {
  attendees: Array<RavenRecipient & { profile: Profile | null }>;
  viewerId: string;
}) {
  if (attendees.length === 0) return null;
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
      {attendees.map((recipient) => {
        const isYou = recipient.recipient_id === viewerId;
        const late = recipient.status === "late";
        const name = isYou ? "You" : (recipient.profile?.display_name ?? "Someone");
        return (
          <div key={recipient.recipient_id} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar
              profile={
                recipient.profile ?? { display_name: name, avatar_url: null, points: 0 }
              }
              size="sm"
            />
            <span className="text-sm font-medium text-ink">{name}</span>
            <span
              className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${
                late ? "bg-late-wash text-late-amber" : "bg-going-wash text-going"
              }`}
            >
              {late ? "Running late" : "In"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
