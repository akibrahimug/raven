import type { ReactNode } from "react";
import { RavenMark } from "@/components/RavenMark";

/** The branded fallback for anything that goes wrong: a crashed page, a
 *  missing route. Never shows raw error text — callers pass friendly copy. */
export function ErrorState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <RavenMark className="size-14 text-ink-faint" />
      <h1 className="invitation text-2xl text-ink-soft">{title}</h1>
      <p className="max-w-[32ch] text-sm text-ink-faint">{message}</p>
      {action}
    </div>
  );
}
