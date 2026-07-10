import { levelForPoints } from "@raven/shared";
import { getFriends, getSessionProfile } from "@/lib/data";
import { CopyInviteButton } from "@/components/CopyInviteButton";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const [session, { added }] = await Promise.all([getSessionProfile(), searchParams]);
  if (!session?.profile) return null;
  const friends = await getFriends(session.userId);

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/j/${session.profile.invite_code}`;

  return (
    <div className="flex flex-col gap-10 pt-4">
      {added ? (
        <p className="rounded-xl bg-going-wash px-4 py-3 text-sm font-medium text-going">
          Friend added — your ravens reach them now.
        </p>
      ) : null}

      <section className="rounded-2xl border border-line bg-raised p-5">
        <h2 className="invitation text-xl">Your invite link</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Every raven you send flies to everyone here — so only invite people you&apos;d
          actually want turning up.
        </p>
        <p className="mt-3 truncate rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink-soft">
          {inviteUrl}
        </p>
        <div className="mt-4">
          <CopyInviteButton url={inviteUrl} senderName={session.profile.display_name} />
        </div>
      </section>

      <section>
        <h2 className="invitation text-xl">Friends</h2>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">No one yet — share your link above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-raised">
            {friends.map((friend) => {
              const level = levelForPoints(friend.points);
              return (
                <li key={friend.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar profile={friend} size="md" />
                  <span className="text-sm font-medium">{friend.display_name}</span>
                  <span className="ml-auto text-xs font-semibold" style={{ color: level.color }}>
                    {level.name}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
