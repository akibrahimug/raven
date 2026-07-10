"use client";

import { useEffect } from "react";
import { friendlyError } from "@raven/shared";
import { ErrorState } from "@/components/ErrorState";

export default function RootError({
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
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
    </main>
  );
}
