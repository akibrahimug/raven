"use client";

import { useState, useTransition } from "react";
import { recallRaven } from "@/lib/actions";
import { SpinnerIcon } from "@/components/icons";

/** Deleting a raven removes it for everyone — ask twice, quietly. */
export function RecallButton({ ravenId }: { ravenId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-ink-faint underline-offset-2 hover:underline"
      >
        Recall this raven
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-ink-soft">Recall it for everyone?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await recallRaven(ravenId);
              if (result?.error) setError(result.error);
            })
          }
          className="flex items-center gap-1.5 font-semibold text-late-amber transition active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? <SpinnerIcon className="size-3.5 animate-spin" /> : null}
          {pending ? "Recalling…" : "Yes, recall"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-ink-faint">
          Keep it
        </button>
      </div>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </div>
  );
}
