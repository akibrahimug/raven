"use client";

import { useOptimistic, useTransition } from "react";
import type { RsvpStatus } from "@raven/shared";
import { rsvp } from "@/lib/actions";

const OPTIONS: Array<{
  status: Exclude<RsvpStatus, "pending">;
  label: string;
  activeClass: string;
}> = [
  { status: "in", label: "I'm in", activeClass: "bg-going-wash text-going border-going/40" },
  { status: "late", label: "Running late", activeClass: "bg-late-wash text-late-amber border-late-amber/40" },
  { status: "cant", label: "Can't", activeClass: "bg-sunken text-ink-soft border-line" },
];

export function RsvpButtons({ ravenId, current }: { ravenId: string; current: RsvpStatus }) {
  const [status, setStatus] = useOptimistic(current);
  const [, startTransition] = useTransition();

  function choose(next: Exclude<RsvpStatus, "pending">) {
    startTransition(async () => {
      setStatus(next);
      await rsvp(ravenId, next);
    });
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Respond">
      {OPTIONS.map((option) => (
        <button
          key={option.status}
          type="button"
          onClick={() => choose(option.status)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            status === option.status
              ? option.activeClass
              : "border-line bg-raised text-ink-soft hover:border-ink-faint"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
