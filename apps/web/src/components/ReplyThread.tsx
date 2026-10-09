"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@raven/shared";
import { createClient } from "@/lib/supabase/client";
import type { ReplyRow } from "@/lib/data";
import { ReplyForm } from "@/components/ReplyForm";

/** Owns the reply list's live state: seeded from the server-rendered
 *  replies, then patched directly — an optimistic entry the instant the
 *  viewer hits Send, and a scoped realtime subscription for everyone else's
 *  messages. No router.refresh() anywhere in this component: a raven's chat
 *  can have real backend latency to the rest of the app without that
 *  latency ever reaching this screen. */
export function ReplyThread({
  ravenId,
  initialReplies,
  participants,
  viewerId,
  expired,
}: {
  ravenId: string;
  initialReplies: ReplyRow[];
  /** Every profile who could plausibly author a reply here — the raven's
   *  sender plus its recipients. A realtime INSERT payload carries only raw
   *  columns, no joined author row, so this is how an incoming message from
   *  someone else still gets a display name without a second network call. */
  participants: Record<string, Profile>;
  viewerId: string;
  expired: boolean;
}) {
  const [replies, setReplies] = useState(initialReplies);
  // Tracks ids already rendered — including temp "pending-…" ids — so the
  // realtime echo of the viewer's own insert (Supabase delivers it to every
  // subscriber, author included) never produces a second bubble.
  const knownIds = useRef(new Set(initialReplies.map((r) => r.id)));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`raven-replies-${ravenId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "raven_replies",
          filter: `raven_id=eq.${ravenId}`,
        },
        (payload) => {
          const row = payload.new as Omit<ReplyRow, "author">;
          if (knownIds.current.has(row.id)) return;
          knownIds.current.add(row.id);
          setReplies((prev) => [...prev, { ...row, author: participants[row.author_id] ?? null }]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // Re-subscribing on every participants change would churn the channel
    // for no reason — the map only grows alongside raven.recipients, which
    // doesn't change mid-thread; author lookups just read the latest closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ravenId]);

  function addOptimistic(reply: ReplyRow) {
    knownIds.current.add(reply.id);
    setReplies((prev) => [...prev, reply]);
  }

  function reconcile(tempId: string, real: ReplyRow) {
    knownIds.current.delete(tempId);
    knownIds.current.add(real.id);
    setReplies((prev) => prev.map((r) => (r.id === tempId ? real : r)));
  }

  function removeOptimistic(tempId: string) {
    knownIds.current.delete(tempId);
    setReplies((prev) => prev.filter((r) => r.id !== tempId));
  }

  const ordered = replies.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="mt-8 border-t border-line pt-5">
      <div className="flex flex-col gap-2">
        {ordered.map((reply) => {
          const mine = reply.author_id === viewerId;
          return (
            <div
              key={reply.id}
              className={`flex max-w-[80%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start self-start"}`}
            >
              {!mine ? (
                <p className="ml-3 text-[11px] font-medium text-ink-faint">
                  {reply.author?.display_name ?? "Someone"}
                </p>
              ) : null}
              {reply.media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reply.media_url}
                  alt=""
                  className="max-h-64 max-w-full rounded-2xl border border-line object-cover"
                />
              ) : null}
              {reply.body ? (
                <div
                  className={`rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                    mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-sunken text-ink"
                  }`}
                >
                  <p>{reply.body}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!expired ? (
        <div className="mt-4">
          <ReplyForm
            ravenId={ravenId}
            viewerId={viewerId}
            onOptimistic={addOptimistic}
            onReconcile={reconcile}
            onFailed={removeOptimistic}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-faint">This raven has flown — the chat is closed.</p>
      )}
    </div>
  );
}
