import { Suspense } from "react";
import { getPast, getSessionProfile } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { RavenCard } from "@/components/RavenCard";
import { RavenMark } from "@/components/RavenMark";
import { RavenListSkeleton } from "@/components/Skeleton";

export const dynamic = "force-dynamic";

export default function PastPage() {
  return (
    <div className="pt-4">
      <PageHeader title="Past ravens" back={{ href: "/", label: "Back to now" }} />
      <Suspense fallback={<RavenListSkeleton label="Loading past ravens" dim />}>
        <PastRavens />
      </Suspense>
    </div>
  );
}

async function PastRavens() {
  const [session, ravens] = await Promise.all([getSessionProfile(), getPast()]);
  if (!session) return null;

  if (ravens.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 pt-20 text-center">
        <RavenMark className="size-14 text-ink-faint" />
        <p className="text-sm text-ink-faint">Nothing has flown yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 opacity-80">
      {ravens.map((raven) => (
        <RavenCard key={raven.id} raven={raven} viewerId={session.userId} />
      ))}
    </div>
  );
}
