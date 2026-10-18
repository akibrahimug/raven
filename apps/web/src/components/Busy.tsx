"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { SpinnerIcon } from "@/components/icons";

/** A button's contents, swapped for a spinner while it works. The label
 *  stays in place but invisible, so the button keeps its exact size and
 *  nothing around it jumps. `className` lays out the label (icon + text). */
export function Busy({
  pending,
  children,
  className = "inline-flex items-center gap-2",
}: {
  pending: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className="relative inline-grid place-items-center">
      <span className={`${className} ${pending ? "invisible" : ""}`}>{children}</span>
      {pending ? (
        <span className="absolute inset-0 grid place-items-center" role="status" aria-label="Working">
          <SpinnerIcon className="size-[1.15em] animate-spin" />
        </span>
      ) : null}
    </span>
  );
}

/** A form's submit button that turns into a spinner the moment it's
 *  pressed — for server-action forms, which otherwise give no sign of life
 *  until the server answers. */
export function SubmitButton({
  children,
  className,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending} className={className}>
      <Busy pending={pending}>{children}</Busy>
    </button>
  );
}
