"use client";

import { useEffect } from "react";
import { friendlyError } from "@raven/shared";
import { ErrorState } from "@/components/ErrorState";

/** Segment-level boundary: header, nav, and the send button stay on screen —
 *  only the page content underneath swaps to this. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went sideways."
      message={friendlyError(error)}
      action={
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Try again
        </button>
      }
    />
  );
}
