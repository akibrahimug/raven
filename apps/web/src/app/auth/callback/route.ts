import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Lands here after both Google OAuth and the email magic link — Supabase's
 *  PKCE flow uses the same `code`-exchange shape for either provider, so one
 *  handler covers both instead of one route per sign-in method. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed (expired/already-used link) — back to
  // signup with something on screen rather than a bare redirect to nowhere.
  return NextResponse.redirect(`${origin}/signup?error=${encodeURIComponent("That link didn't work — try again.")}`);
}
