import { redirect } from "next/navigation";
import { completeOnboarding, signOut } from "@/lib/actions";
import { getSessionProfile } from "@/lib/data";
import { safeNext } from "@/lib/redirect";
import { RavenMark } from "@/components/RavenMark";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [session, params] = await Promise.all([getSessionProfile(), searchParams]);
  const next = safeNext(params.next);
  const { error } = params;
  if (!session) redirect("/login");
  if (session.profile) redirect(next);
  const hint = session.oauthHint;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
      {hint?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hint.avatarUrl} alt="" className="size-14 rounded-full border border-line object-cover" />
      ) : (
        <RavenMark className="size-12 text-accent" />
      )}
      <p className="mt-5 text-sm font-semibold text-accent">Welcome to Raven.</p>
      <h1 className="invitation mt-1 text-3xl">What do your friends call you?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        This is the name that lands with your ravens. First name is perfect.
      </p>
      <form action={completeOnboarding} className="mt-8 flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        {hint?.avatarUrl ? <input type="hidden" name="avatar_url" value={hint.avatarUrl} /> : null}
        <input
          name="display_name"
          required
          maxLength={40}
          autoFocus
          defaultValue={hint?.displayName ?? ""}
          placeholder="AK"
          className="rounded-2xl border border-line bg-raised px-5 py-4 text-lg focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="mt-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97]"
        >
          Done
        </button>
      </form>
      {hint ? (
        <p className="mt-3 text-center text-xs text-ink-faint">
          Pulled from your Google account — change it if you&apos;d rather use something else.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-late-amber">{error}</p> : null}
      <form action={signOut} className="mt-4 text-center">
        <button type="submit" className="text-sm text-ink-faint underline-offset-2 hover:underline">
          Not you? Sign out
        </button>
      </form>
      {/* Changed your mind partway through? Settings is out of reach until
          sign-up finishes, so the way out is here too. */}
      <div className="mt-2 flex flex-col items-center">
        <DeleteAccountButton />
      </div>
    </main>
  );
}
