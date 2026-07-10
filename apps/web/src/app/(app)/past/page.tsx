import Link from "next/link";
import { getPast, getSessionProfile } from "@/lib/data";
import { RavenCard } from "@/components/RavenCard";
import { RavenMark } from "@/components/RavenMark";

export const dynamic = "force-dynamic";

export default async function PastPage() {
  const session = await getSessionProfile();
  if (!session) return null;
  const ravens = await getPast();

  return (
    <div className="pt-4">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="invitation text-2xl">Past ravens</h1>
        <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
          Back to now
        </Link>
      </div>

      {ravens.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-20 text-center">
          <RavenMark className="size-14 text-ink-faint" />
          <p className="text-sm text-ink-faint">Nothing has flown yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 opacity-80">
          {ravens.map((raven) => (
            <RavenCard key={raven.id} raven={raven} viewerId={session.userId} />
          ))}
        </div>
      )}
    </div>
  );
}
