import { PageHeader } from "@/components/PageHeader";
import { RavenListSkeleton } from "@/components/Skeleton";

export default function PastLoading() {
  return (
    <div className="pt-4">
      <PageHeader title="Past ravens" back={{ href: "/", label: "Back to now" }} />
      <RavenListSkeleton label="Loading past ravens" dim />
    </div>
  );
}
