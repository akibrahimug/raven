"use client";

import { useState, useTransition } from "react";
import type { RequestPerson } from "@/lib/data";
import { answerFriendRequest, withdrawFriendRequest } from "@/lib/actions";
import { Avatar } from "@/components/Avatar";
import { SpinnerIcon } from "@/components/icons";

/** People asking to be your friend, and the people you've asked. Nobody's
 *  ravens reach anyone until the person asked says yes. */
export function FriendRequests({
  incoming,
  outgoing,
}: {
  incoming: RequestPerson[];
  outgoing: RequestPerson[];
}) {
  // Rows leave the moment they're answered; the server's re-render follows.
  const [done, setDone] = useState<Set<string>>(new Set());
  const markDone = (id: string) => setDone((prev) => new Set(prev).add(id));
  const asking = incoming.filter((person) => !done.has(person.id));
  const waiting = outgoing.filter((person) => !done.has(person.id));
  if (!asking.length && !waiting.length) return null;

  return (
    <div className="flex flex-col gap-10">
      {asking.length ? (
        <section>
          <h2 className="invitation text-xl">Asking to be friends</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-raised">
            {asking.map((person) => (
              <IncomingRow key={person.id} person={person} onDone={() => markDone(person.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      {waiting.length ? (
        <section>
          <h2 className="invitation text-xl">Waiting on</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-raised">
            {waiting.map((person) => (
              <OutgoingRow key={person.id} person={person} onDone={() => markDone(person.id)} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function IncomingRow({ person, onDone }: { person: RequestPerson; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [answering, setAnswering] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function answer(accept: boolean) {
    setAnswering(accept ? "yes" : "no");
    setError(null);
    startTransition(async () => {
      const result = await answerFriendRequest(person.id, accept);
      if (result.error) {
        setError(result.error);
        setAnswering(null);
      } else {
        onDone();
      }
    });
  }

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar profile={person} size="md" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.display_name}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => answer(false)}
          className="text-sm text-ink-faint hover:text-ink disabled:opacity-50"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => answer(true)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97] disabled:opacity-60"
        >
          {answering === "yes" ? <SpinnerIcon className="size-3.5 animate-spin" /> : null}
          {answering === "yes" ? "Adding…" : "Accept"}
        </button>
      </div>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </li>
  );
}

function OutgoingRow({ person, onDone }: { person: RequestPerson; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar profile={person} size="md" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.display_name}</span>
        <span className="text-xs text-ink-faint">Asked</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await withdrawFriendRequest(person.id);
              if (result.error) setError(result.error);
              else onDone();
            })
          }
          className="flex items-center gap-1.5 text-sm text-ink-faint underline-offset-2 hover:underline disabled:opacity-50"
        >
          {pending ? <SpinnerIcon className="size-3.5 animate-spin" /> : null}
          {pending ? "Taking back…" : "Take back"}
        </button>
      </div>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </li>
  );
}
