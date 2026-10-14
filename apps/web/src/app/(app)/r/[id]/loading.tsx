import Link from "next/link";
import { Bone, LoadingRegion, Slab } from "@/components/Skeleton";

// Mirrors the raven page: sender line, the message, the RSVP row, who's in.
// The back link is real, so you can leave before it finishes loading.
export default function RavenLoading() {
  return (
    <div className="pt-4">
      <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
        ← Back
      </Link>
      <LoadingRegion label="Loading this raven" className="mt-6">
        <div className="flex items-center gap-2">
          <Bone className="size-7" />
          <Bone className="h-3 w-24" />
          <Bone className="h-3 w-20" />
        </div>
        <Bone className="mt-4 h-7 w-11/12" />
        <Bone className="mt-2.5 h-7 w-2/3" />
        <div className="mt-6 flex gap-2">
          <Bone className="h-8 w-[4.5rem]" />
          <Bone className="h-8 w-28" />
          <Bone className="h-8 w-16" />
        </div>
        <Slab className="mt-8 h-24 rounded-2xl" />
      </LoadingRegion>
    </div>
  );
}
