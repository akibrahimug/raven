"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RavenMark } from "@/components/RavenMark";

/** Floating send button — hidden on the compose screen, which has its own. */
export function SendFab() {
  const pathname = usePathname();
  if (pathname === "/compose") return null;

  return (
    <Link
      href="/compose"
      className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-accent py-3.5 pl-5 pr-6 text-base font-semibold text-white shadow-[0_8px_24px_rgba(255,92,57,0.30)] transition-colors hover:bg-accent-deep"
    >
      <RavenMark className="size-5 text-white" />
      Send a Raven
    </Link>
  );
}
