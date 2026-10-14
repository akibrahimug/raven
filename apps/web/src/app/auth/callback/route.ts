import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";

/** Lands here after both Google OAuth and the email magic link — Supabase's
 *  PKCE flow uses the same `code`-exchange shape for either provider, so one
 *  handler covers both instead of one route per sign-in method. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Signing up is email first, then the phone number: an account that
      // hasn't verified one yet goes straight on to that step.
      const destination = data.user.phone_confirmed_at
        ? next
        : `/phone?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // No code, or the exchange failed (expired/already-used link) — back to
  // signup with something on screen rather than a bare redirect to nowhere.
  return NextResponse.redirect(`${origin}/signup?error=${encodeURIComponent("That link didn't work — try again.")}`);
}
