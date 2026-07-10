import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/data";
import { RavenMark } from "@/components/RavenMark";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { SendFab } from "@/components/SendFab";
import { Avatar } from "@/components/Avatar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-paper/90 px-4 py-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <RavenMark className="size-6 text-accent" />
          <span className="invitation text-xl font-semibold">Raven</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-ink-soft">
          <Link href="/past" className="hover:text-ink">
            Past
          </Link>
          <Link href="/friends" className="hover:text-ink">
            Friends
          </Link>
          <Link href="/settings" aria-label="Settings">
            <Avatar profile={session.profile} size="md" />
          </Link>
        </nav>
      </header>

      <main className="flex-1 pb-28 pt-2">{children}</main>

      <SendFab />

      <RealtimeRefresh />
    </div>
  );
}
