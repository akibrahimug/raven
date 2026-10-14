"use client";

import { useState, useTransition } from "react";
import { setDiscoverable } from "@/lib/actions";

/** Whether someone with your number finds you when they check their
 *  contacts for friends on Raven. Friends always see each other. */
export function DiscoverableToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flip() {
    const next = !on;
    setOn(next); // instant; put back if the save fails
    setError(null);
    startTransition(async () => {
      const result = await setDiscoverable(next);
      if (result.error) {
        setOn(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">Let people with your number find you</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            They&apos;d see your name and photo when they check their contacts, and could ask to be
            friends.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Let people with your number find you"
          disabled={pending}
          onClick={flip}
          className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${
            on ? "bg-accent" : "bg-line"
          }`}
        >
          <span
            className={`absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
              on ? "translate-x-[1.125rem]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </div>
  );
}
