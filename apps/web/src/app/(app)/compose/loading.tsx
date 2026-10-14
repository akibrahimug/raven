import { PageHeader } from "@/components/PageHeader";
import { Bone, LoadingRegion, Slab } from "@/components/Skeleton";

// Only up until the page itself arrives — the form doesn't wait on data.
// Mirrors ComposeForm: message box, photo/location chips, how long you're
// around for, the send button.
export default function ComposeLoading() {
  return (
    <div className="pt-4">
      <PageHeader title="New raven" back={{ href: "/", label: "Cancel" }} />
      <LoadingRegion label="Loading" className="flex flex-col gap-7">
        <Slab className="h-[7.6rem] rounded-2xl" />
        <div className="-mt-3 flex gap-2">
          <Bone className="h-8 w-32" />
          <Bone className="h-8 w-36" />
        </div>
        <div>
          <Bone className="mb-2 h-3 w-28" />
          <Bone className="h-[2.6rem] w-[22rem] max-w-full" />
          <Bone className="mt-2 h-3 w-60" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Bone className="h-[3.25rem] w-48" />
          <Bone className="my-0.5 h-3 w-56" />
        </div>
      </LoadingRegion>
    </div>
  );
}
