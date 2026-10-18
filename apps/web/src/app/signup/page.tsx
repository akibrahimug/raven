"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AUTH_NOTICES, friendlyError } from "@raven/shared";
import { createClient } from "@/lib/supabase/client";
import { RavenMark } from "@/components/RavenMark";
import { Busy } from "@/components/Busy";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.48a5.55 5.55 0 0 1-2.4 3.64v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3a7.4 7.4 0 0 1-11-3.89H.98v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.07 14.19a7.2 7.2 0 0 1 0-4.38v-3.1H.98a12 12 0 0 0 0 10.58l4.09-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 .98 6.71l4.09 3.1A7.15 7.15 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const urlError = searchParams.get("error");
  // Arrived from /login with a number no account has, or from deleting one.
  const noticeKey = searchParams.get("notice");
  const notice =
    noticeKey === "no-account" || noticeKey === "deleted" ? AUTH_NOTICES[noticeKey] : null;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [error, setError] = useState<string | null>(urlError);

  async function continueWithGoogle() {
    setBusyGoogle(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser navigates away to Google — this only runs on
    // immediate failure (e.g. provider misconfigured), not after redirect.
    if (error) {
      setBusyGoogle(false);
      setError(friendlyError(error));
    }
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setBusyEmail(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusyEmail(false);
    if (error) setError(friendlyError(error));
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
      <div className="flex flex-col items-center text-center">
        <RavenMark className="size-16 text-accent" />
        <h1 className="invitation mt-4 text-4xl">Raven</h1>
        <p className="mt-2 text-ink-soft">Plans, not group chats.</p>
      </div>

      <div className="mt-12 flex flex-col gap-3">
        {notice ? (
          <p className="mb-1 rounded-2xl border border-line bg-raised px-5 py-4 text-center text-sm text-ink-soft">
            {notice}
          </p>
        ) : null}
        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={busyGoogle}
          className="flex items-center justify-center gap-3 rounded-full border border-line bg-raised px-6 py-3.5 text-base font-semibold text-ink transition hover:border-ink-faint active:scale-[0.97] disabled:opacity-60"
        >
          <Busy pending={busyGoogle} className="inline-flex items-center gap-3">
            <GoogleIcon className="size-5" />
            Continue with Google
          </Busy>
        </button>

        <div className="my-1 flex items-center gap-3 text-xs text-ink-faint">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        {sent ? (
          <p className="rounded-2xl border border-line bg-raised px-5 py-4 text-center text-sm text-ink-soft">
            Check your email — we sent a link to <strong className="text-ink">{email}</strong>.
          </p>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="rounded-2xl border border-line bg-raised px-5 py-4 text-base focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={busyEmail || !email.trim()}
              className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97] disabled:opacity-40"
            >
              <Busy pending={busyEmail}>Continue with email</Busy>
            </button>
          </form>
        )}
      </div>

      {error ? <p className="mt-4 text-center text-sm text-late-amber">{error}</p> : null}

      <p className="mt-10 text-center text-sm text-ink-soft">
        Already on Raven?{" "}
        <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink hover:text-accent">
          Log in with your phone
        </Link>
      </p>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
