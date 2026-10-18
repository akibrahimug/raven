import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { getSessionProfile } from "@/lib/data";
import { safeNext } from "@/lib/redirect";
import { RavenMark } from "@/components/RavenMark";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { PhoneForm } from "@/components/PhoneForm";

/** Step two of signing up, after Google or the email link: the number is
 *  what this account logs back in with, so middleware keeps every other
 *  page closed until it's verified. */
export default async function PhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, params] = await Promise.all([getSessionProfile(), searchParams]);
  const next = safeNext(params.next);
  if (!session) redirect("/signup");
  if (session.phoneVerified) {
    redirect(session.profile ? next : `/onboarding?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
      <RavenMark className="size-12 text-accent" />
      <h1 className="invitation mt-5 text-3xl">What&apos;s your number?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        It&apos;s how you log in to Raven. We&apos;ll text you a code to check it&apos;s yours.
      </p>
      <PhoneForm next={next} hasProfile={Boolean(session.profile)} />
      <SignOutButton label="Not you? Sign out" className="mt-4 text-center" />
      {/* Changed your mind partway through? Settings is out of reach until
          sign-up finishes, so the way out is here too. */}
      <div className="mt-2 flex flex-col items-center">
        <DeleteAccountButton />
      </div>
    </main>
  );
}
