"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/actions";
import { Busy } from "@/components/Busy";

/** The sign-out link, which says so the moment it's tapped. */
export function SignOutButton({ label = "Sign out", className = "" }: { label?: string; className?: string }) {
  return (
    <form action={signOut} className={className}>
      <Submit label={label} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="text-sm text-ink-faint underline-offset-2 hover:underline disabled:no-underline"
    >
      <Busy pending={pending}>{label}</Busy>
    </button>
  );
}
