"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/lib/actions";
import { deleteOwnPhotos } from "@/lib/storage";
import { SpinnerIcon } from "@/components/icons";

/** Deleting your account can't be undone — say exactly what goes, then ask. */
export function DeleteAccountButton() {
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
        Delete account
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 self-stretch rounded-2xl border border-line bg-raised p-5 text-sm">
      <p className="font-semibold text-ink">Delete your account?</p>
      <p className="text-ink-soft">
        Your profile, friends, ravens, replies and photos go for good. This can&apos;t be undone.
      </p>
      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                // Photos first: the database won't delete an account that
                // still has some (they live outside its cascades).
                await deleteOwnPhotos();
              } catch (photoError) {
                setError(photoError instanceof Error ? photoError.message : "Couldn't delete your photos — try again.");
                return;
              }
              // Only comes back on failure — success redirects to /signup.
              const result = await deleteAccount();
              if (result?.error) setError(result.error);
            })
          }
          className="flex items-center gap-1.5 font-semibold text-late-amber transition active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? <SpinnerIcon className="size-3.5 animate-spin" /> : null}
          {pending ? "Deleting…" : "Yes, delete everything"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="text-ink-faint disabled:opacity-50"
        >
          Keep it
        </button>
      </div>
      {error ? <p className="text-xs text-late-amber">{error}</p> : null}
    </div>
  );
}
