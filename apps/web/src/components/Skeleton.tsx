import type { ReactNode } from "react";

// Placeholder shapes for data that's still on its way. Every route has a
// loading.tsx built from these, so a tap moves to the new page at once and
// the data fills in behind it. Each is sized and spaced like the thing it
// stands in for, so nothing jumps when the real content lands.

/** A line of text, a pill, or a circle. */
export function Bone({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`block rounded-full bg-sunken motion-safe:animate-pulse ${className}`} />
  );
}

/** A block: an input, a text box, a photo. Rounding comes from the caller,
 *  to match the corner of whatever it stands in for. */
export function Slab({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block bg-sunken motion-safe:animate-pulse ${className}`} />;
}

/** Marks a region as loading for screen readers; the shapes inside are hidden. */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Mirrors RavenCard: sender, the message, the RSVP row, the drain line. */
export function RavenCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-raised px-5 pb-4 pt-4 shadow-[0_1px_2px_rgba(26,25,23,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Bone className="size-7" />
          <Bone className="h-3 w-20" />
        </span>
        <Bone className="h-3 w-12" />
      </div>
      <Bone className="mt-3 h-5 w-11/12" />
      <Bone className="mt-2 h-5 w-3/5" />
      <div className="mt-4 flex gap-2">
        <Bone className="h-8 w-[4.5rem]" />
        <Bone className="h-8 w-28" />
        <Bone className="h-8 w-16" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-sunken" />
    </div>
  );
}

export function RavenListSkeleton({ label, dim = false }: { label: string; dim?: boolean }) {
  return (
    <LoadingRegion label={label} className={`flex flex-col gap-4 ${dim ? "opacity-80" : ""}`}>
      <RavenCardSkeleton />
      <RavenCardSkeleton />
      <RavenCardSkeleton />
    </LoadingRegion>
  );
}

/** Mirrors InboxTabs. The tabs are plain text here, not buttons — a tab
 *  picked during loading would be lost when the real list replaces this. */
export function InboxSkeleton({ sent = false }: { sent?: boolean }) {
  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium ${active ? "bg-ink text-paper" : "text-ink-soft"}`;
  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit rounded-full border border-line bg-raised p-1">
        <span className={tab(!sent)}>For you</span>
        <span className={tab(sent)}>Sent</span>
      </div>
      <RavenListSkeleton label="Loading your ravens" />
    </div>
  );
}

/** Mirrors the friends list rows: avatar, name, level. */
export function FriendRowsSkeleton() {
  return (
    <LoadingRegion
      label="Loading your friends"
      className="mt-3 divide-y divide-line rounded-2xl border border-line bg-raised"
    >
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-3">
          <Bone className="size-9" />
          <Bone className="h-3.5 w-28" />
          <Bone className="ml-auto h-3 w-16" />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** The single-column screens around sign-up (/phone, /onboarding, /j/…):
 *  the mark, a heading, a field, a button. */
export function CenteredFormSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
      <LoadingRegion label={label}>
        <Bone className="size-12" />
        <Bone className="mt-6 h-7 w-3/4" />
        <Bone className="mt-3 h-3.5 w-full" />
        <Bone className="mt-2 h-3.5 w-2/3" />
        <Slab className="mt-8 h-[3.75rem] rounded-2xl" />
        <Bone className="mt-5 h-[3.25rem] w-full" />
      </LoadingRegion>
    </main>
  );
}
