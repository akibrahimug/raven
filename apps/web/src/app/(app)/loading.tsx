import { InboxSkeleton } from "@/components/Skeleton";

// Shown the instant the inbox is opened — Next.js prefetches it along with
// every visible link — while the ravens themselves load.
export default function InboxLoading() {
  return <InboxSkeleton />;
}
