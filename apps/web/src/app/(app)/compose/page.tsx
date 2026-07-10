import Link from "next/link";
import { getFriends, getSessionProfile } from "@/lib/data";
import { ComposeForm } from "@/components/ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const session = await getSessionProfile();
  if (!session) return null;
  const friends = await getFriends(session.userId);

  return (
    <div className="pt-4">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="invitation text-2xl">New raven</h1>
        <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancel
        </Link>
      </div>
      <ComposeForm friendCount={friends.length} />
    </div>
  );
}
