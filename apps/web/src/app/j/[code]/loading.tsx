import { RavenMark } from "@/components/RavenMark";
import { Bone, LoadingRegion } from "@/components/Skeleton";

// Mirrors the invite page — usually someone's first look at Raven, opened
// from a shared link, so the page shows up before it knows who sent it.
export default function InviteLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <RavenMark className="size-16 text-accent" />
      <LoadingRegion label="Loading this invite" className="flex w-full flex-col items-center">
        <Bone className="mt-6 h-8 w-4/5" />
        <Bone className="mt-2.5 h-8 w-1/2" />
        <Bone className="mt-5 h-3.5 w-[30ch] max-w-full" />
        <Bone className="mt-2 h-3.5 w-[26ch] max-w-full" />
        <Bone className="mt-2 h-3.5 w-[20ch] max-w-full" />
        <Bone className="mt-10 h-[3.25rem] w-40" />
      </LoadingRegion>
    </main>
  );
}
