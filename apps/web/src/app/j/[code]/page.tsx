import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data";
import { redeemInvite } from "@/lib/actions";
import { RavenMark } from "@/components/RavenMark";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ code }, { error }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invite_profile", { code });
  const inviter = data?.[0] ?? null;

  if (!inviter) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <RavenMark className="size-14 text-ink-faint" />
        <h1 className="invitation mt-5 text-2xl text-ink-soft">This invite has flown.</h1>
        <p className="mt-2 text-sm text-ink-faint">
          The link is wrong or no longer exists. Ask your friend to send it again.
        </p>
      </main>
    );
  }

  const session = await getSessionProfile();
  if (session && !session.profile) {
    redirect(`/onboarding?next=${encodeURIComponent(`/j/${code}`)}`);
  }

  const acceptWithCode = redeemInvite.bind(null, code);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <RavenMark className="size-16 text-accent" />
      <h1 className="invitation mt-6 text-3xl">
        {inviter.display_name} wants to send you ravens.
      </h1>
      <p className="mt-3 max-w-[32ch] text-sm text-ink-soft">
        A raven is a one-line invitation — &ldquo;I&rsquo;m at the pub for an hour if anyone&rsquo;s
        nearby.&rdquo; No group chats, no feeds. Just friends telling friends what&rsquo;s
        happening.
      </p>

      {error ? <p className="mt-4 text-sm text-late-amber">{error}</p> : null}

      {session ? (
        <form action={acceptWithCode} className="mt-10">
          <button
            type="submit"
            className="rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Add {inviter.display_name}
          </button>
        </form>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(`/j/${code}`)}`}
          className="mt-10 rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Sign in to accept
        </Link>
      )}
    </main>
  );
}
