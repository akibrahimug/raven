"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AUTH_NOTICES, friendlyError } from "@raven/shared";
import { createClient } from "@/lib/supabase/client";
import { normalisePhone } from "@/lib/format";
import { takeStashedPhone } from "@/lib/handoff";
import { safeNext } from "@/lib/redirect";
import { RavenMark } from "@/components/RavenMark";
import { Busy } from "@/components/Busy";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  // Arrived from the sign-up phone step with a number that's already on file.
  const notice = searchParams.get("notice") === "taken" ? AUTH_NOTICES.taken : null;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stashed = takeStashedPhone();
    if (stashed) setPhone(stashed);
  }, []);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalisePhone(phone),
      // Logging in never makes an account — signing up starts with email.
      options: { shouldCreateUser: false },
    });
    if (error?.code === "otp_disabled") {
      // No account has this number.
      router.push(`/signup?notice=no-account${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
      return;
    }
    setBusy(false);
    if (error) setError(friendlyError(error));
    else setStep("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalisePhone(phone),
      token: code.trim(),
      type: "sms",
    });
    if (error || !data.user) {
      setBusy(false);
      setError(error ? friendlyError(error) : "That code didn't match.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();
    // No router.refresh() after this: the push already renders the page fresh
    // with the new session, and a refresh on its heels makes the router wait
    // for a second copy of the same page before showing anything.
    router.push(profile ? next : `/onboarding?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
      <div className="flex flex-col items-center text-center">
        <RavenMark className="size-16 text-accent" />
        <h1 className="invitation mt-4 text-4xl">Raven</h1>
        <p className="mt-2 text-ink-soft">Plans, not group chats.</p>
      </div>

      {step === "phone" ? (
        <form onSubmit={requestCode} className="mt-12 flex flex-col gap-3">
          {notice ? (
            <p className="mb-2 rounded-2xl border border-line bg-raised px-5 py-4 text-center text-sm text-ink-soft">
              {notice}
            </p>
          ) : null}
          <label htmlFor="phone" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Your phone number
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="07700 900001"
            className="rounded-2xl border border-line bg-raised px-5 py-4 text-lg tracking-wide focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || phone.trim().length < 10}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97] disabled:opacity-60"
          >
            <Busy pending={busy}>Text me a code</Busy>
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-12 flex flex-col gap-3">
          <label htmlFor="code" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            The code we texted {normalisePhone(phone)}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            className="rounded-2xl border border-line bg-raised px-5 py-4 text-center text-2xl tracking-[0.4em] focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition hover:bg-accent-deep active:scale-[0.97] disabled:opacity-60"
          >
            <Busy pending={busy}>Sign in</Busy>
          </button>
          <button
            type="button"
            onClick={() => setStep("phone")}
            className="text-sm text-ink-faint hover:text-ink"
          >
            Different number
          </button>
        </form>
      )}

      {error ? <p className="mt-4 text-center text-sm text-late-amber">{error}</p> : null}

      <p className="mt-10 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink hover:text-accent">
          Sign up
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
