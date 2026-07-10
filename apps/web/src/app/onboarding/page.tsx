import { redirect } from "next/navigation";
import { completeOnboarding, signOut } from "@/lib/actions";
import { getSessionProfile } from "@/lib/data";
import { RavenMark } from "@/components/RavenMark";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [session, { next, error }] = await Promise.all([getSessionProfile(), searchParams]);
  if (!session) redirect("/login");
  if (session.profile) redirect(next || "/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
      <RavenMark className="size-12 text-accent" />
      <h1 className="invitation mt-5 text-3xl">What do your friends call you?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        This is the name that lands with your ravens. First name is perfect.
      </p>
      <form action={completeOnboarding} className="mt-8 flex flex-col gap-3">
        <input type="hidden" name="next" value={next || "/"} />
        <input
          name="display_name"
          required
          maxLength={40}
          autoFocus
          placeholder="AK"
          className="rounded-2xl border border-line bg-raised px-5 py-4 text-lg focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="mt-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          Done
        </button>
      </form>
      {error ? <p className="mt-4 text-sm text-late-amber">{error}</p> : null}
      <form action={signOut} className="mt-4 text-center">
        <button type="submit" className="text-sm text-ink-faint underline-offset-2 hover:underline">
          Not you? Sign out
        </button>
      </form>
    </main>
  );
}
