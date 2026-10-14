import { getFriendCount } from "@/lib/data";
import { ComposeForm } from "@/components/ComposeForm";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function ComposePage() {
  return (
    <div className="pt-4">
      <PageHeader title="New raven" back={{ href: "/", label: "Cancel" }} />
      {/* Deliberately not awaited — see ComposeForm. */}
      <ComposeForm friendCount={getFriendCount()} />
    </div>
  );
}
