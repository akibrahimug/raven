"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { friendlyError } from "@raven/shared";
import { createClient } from "@/lib/supabase/client";
import { normalisePhone } from "@/lib/format";
import { RavenMark } from "@/components/RavenMark";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: normalisePhone(phone) });
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
    router.push(profile ? next : `/onboarding?next=${encodeURIComponent(next)}`);
    router.refresh();
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
            className="mt-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
          >
            Text me a code
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
            className="mt-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-40"
          >
            Sign in
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
