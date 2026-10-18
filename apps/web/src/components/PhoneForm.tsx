"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError, isTestNumber } from "@raven/shared";
import { createClient } from "@/lib/supabase/client";
import { normalisePhone } from "@/lib/format";
import { stashPhone } from "@/lib/handoff";
import { Busy } from "@/components/Busy";

/** Attaches a number to the Google/email account that's signed in. The
 *  server texts it a code and changes nothing until that code comes back. */
export function PhoneForm({ next, hasProfile }: { next: string; hasProfile: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    const number = normalisePhone(phone);
    if (isTestNumber(number)) {
      setError("That number's kept for testing — use your own.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ phone: number });
    if (error?.code === "phone_exists") {
      // A number belongs to one account, and this one has its own already:
      // that's a log in, not a sign-up. Drop the half-made sign-up session
      // so the login page starts clean.
      await supabase.auth.signOut();
      stashPhone(number);
      router.push(`/login?notice=taken${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
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
    const { error } = await supabase.auth.verifyOtp({
      phone: normalisePhone(phone),
      token: code.trim(),
      type: "phone_change",
    });
    if (error) {
      setBusy(false);
      setError(friendlyError(error));
      return;
    }
    // Fresh render with the new session — no refresh needed (see login).
    router.push(hasProfile ? next : `/onboarding?next=${encodeURIComponent(next)}`);
  }

  return (
    <>
      {step === "phone" ? (
        <form onSubmit={requestCode} className="mt-8 flex flex-col gap-3">
          <label htmlFor="phone" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Your phone number
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            required
            autoFocus
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
        <form onSubmit={verifyCode} className="mt-8 flex flex-col gap-3">
          <label htmlFor="code" className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            The code we texted {normalisePhone(phone)}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
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
            <Busy pending={busy}>Verify number</Busy>
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
            className="text-sm text-ink-faint hover:text-ink"
          >
            Different number
          </button>
        </form>
      )}
      {error ? <p className="mt-4 text-sm text-late-amber">{error}</p> : null}
    </>
  );
}
