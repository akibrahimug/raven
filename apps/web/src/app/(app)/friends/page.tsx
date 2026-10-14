import { Suspense } from "react";
import { levelForPoints } from "@raven/shared";
import { getFriendRequests, getFriends, getSessionProfile } from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { FriendRequests } from "@/components/FriendRequests";
import { InviteCard } from "@/components/InviteCard";
import { FriendRowsSkeleton } from "@/components/Skeleton";

export const dynamic = "force-dynamic";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ asked?: string; friends?: string }>;
}) {
  const [session, { asked, friends: nowFriends }] = await Promise.all([
    getSessionProfile(),
    searchParams,
  ]);
  if (!session?.profile) return null;

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/j/${session.profile.invite_code}`;

  return (
    <div className="flex flex-col gap-10 pt-4">
      {asked ? (
        <p className="rounded-xl bg-going-wash px-4 py-3 text-sm font-medium text-going">
          Asked — you&apos;ll be friends as soon as they say yes.
        </p>
      ) : null}
      {nowFriends ? (
        <p className="rounded-xl bg-going-wash px-4 py-3 text-sm font-medium text-going">
          You&apos;re friends now — your ravens reach each other.
        </p>
      ) : null}

      <Suspense fallback={null}>
        <Requests />
      </Suspense>

      <InviteCard invite={{ url: inviteUrl, senderName: session.profile.display_name }} />

      <section>
        <h2 className="invitation text-xl">Friends</h2>
        <Suspense fallback={<FriendRowsSkeleton />}>
          <FriendList userId={session.userId} />
        </Suspense>
      </section>
    </div>
  );
}

/** Only takes up room when someone's asking, or you are. */
async function Requests() {
  const { incoming, outgoing } = await getFriendRequests();
  return <FriendRequests incoming={incoming} outgoing={outgoing} />;
}

async function FriendList({ userId }: { userId: string }) {
  const friends = await getFriends(userId);
  if (friends.length === 0) {
    return <p className="mt-2 text-sm text-ink-faint">No one yet — share your link above.</p>;
  }
  return (
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
  );
}
