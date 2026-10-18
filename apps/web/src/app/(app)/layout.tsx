import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveFriendRavens, getFriendRequests, getSessionProfile } from "@/lib/data";
import { RavenMark } from "@/components/RavenMark";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { SendFab } from "@/components/SendFab";
import { Avatar } from "@/components/Avatar";
import { Bone } from "@/components/Skeleton";

/** Renders without waiting on anything, so every page underneath can show
 *  its loading state the moment it's opened — only the avatar streams in. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
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
          <Link href="/friends" className="relative hover:text-ink">
            Friends
            <Suspense fallback={null}>
              <FriendsDot />
            </Suspense>
          </Link>
          <Link href="/settings" aria-label="Settings">
            <Suspense fallback={<Bone className="size-9" />}>
              <HeaderAvatar />
            </Suspense>
          </Link>
        </nav>
      </header>

      <main className="flex-1 pb-28 pt-2">{children}</main>

      <SendFab />

      <RealtimeRefresh />
    </div>
  );
}

/** Also the app's last gate: middleware has already turned away anyone
 *  signed out or without a verified number, which leaves a missing profile
 *  — someone who hasn't picked a name yet. */
async function HeaderAvatar() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/onboarding");
  return <Avatar profile={session.profile} size="md" />;
}

/** Someone's asking to be friends, or a friend has a raven out. A failed
 *  lookup just means no dot — it mustn't take the whole app down with it. */
async function FriendsDot() {
  const session = await getSessionProfile();
  if (!session) return null;
  const [incoming, flying] = await Promise.all([
    getFriendRequests()
      .then((requests) => requests.incoming.length)
      .catch(() => 0),
    getActiveFriendRavens(session.userId)
      .then((ravens) => ravens.size)
      .catch(() => 0),
  ]);
  if (!incoming && !flying) return null;
  const said = [
    incoming ? `${incoming} asking to be friends` : null,
    flying ? `${flying} with a raven out` : null,
  ].filter(Boolean);
  return (
    <>
      <span aria-hidden="true" className="absolute -right-2 -top-0.5 size-2 rounded-full bg-accent" />
      <span className="sr-only">, {said.join(", ")}</span>
    </>
  );
}
