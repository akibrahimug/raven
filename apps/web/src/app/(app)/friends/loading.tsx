import { InviteCard } from "@/components/InviteCard";
import { FriendRowsSkeleton } from "@/components/Skeleton";

export default function FriendsLoading() {
  return (
    <div className="flex flex-col gap-10 pt-4">
      <InviteCard />
      <section>
        <h2 className="invitation text-xl">Friends</h2>
        <FriendRowsSkeleton />
      </section>
    </div>
  );
}
