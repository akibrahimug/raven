"use client";

import { useState } from "react";
import type { InboxRaven } from "@/lib/data";
import { RavenCard } from "@/components/RavenCard";
import { RavenMark } from "@/components/RavenMark";

/** Owns the For you/Sent toggle entirely client-side. The page fetches
 *  getInbox() exactly once — both tabs are a filter over the same array,
 *  never two different queries — so switching tabs was never a case that
 *  needed a network round trip. It used to be two <Link>s to /?tab=sent,
 *  which on this backend's latency meant every tab switch waited on a full
 *  server re-render for data the client already had in hand. */
export function InboxTabs({
  ravens,
  viewerId,
  initialSent,
}: {
  ravens: InboxRaven[];
  viewerId: string;
  initialSent: boolean;
}) {
  // Only seeds from the URL on first mount, so a shared /?tab=sent link still
  // opens on the right tab — subsequent switches are local and instant.
  const [sent, setSent] = useState(initialSent);
  const filtered = ravens.filter((raven) =>
    sent ? raven.sender_id === viewerId : raven.sender_id !== viewerId,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit rounded-full border border-line bg-raised p-1">
        <button
          type="button"
          onClick={() => setSent(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !sent ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          For you
        </button>
        <button
          type="button"
          onClick={() => setSent(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            sent ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          Sent
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-20 text-center">
          <RavenMark className="size-16 text-ink-faint" />
          <p className="invitation text-2xl text-ink-soft">
            {sent ? "You haven't sent one yet." : "The sky is clear."}
          </p>
          <p className="max-w-[26ch] text-sm text-ink-faint">
            {sent
              ? "Tap Send a Raven whenever you're up to something."
              : "When a friend is up to something, it'll land here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((raven) => (
            <RavenCard key={raven.id} raven={raven} viewerId={viewerId} />
          ))}
        </div>
      )}
    </div>
  );
}
