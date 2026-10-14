/**
 * Turns raw Postgres/PostgREST/Supabase-auth/network error text into short,
 * human copy. Only remaps known-technical patterns — anything else (including
 * our own hand-written messages like "No one to send to yet") passes through
 * unchanged, since those were already written for a person to read.
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  // Supabase's PostgrestError/AuthError-shaped objects (and RPC errors) are
  // plain objects, not Error instances — {code, details, hint, message}.
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
}

export function friendlyError(error: unknown): string {
  const message = extractMessage(error);
  if (!message) return "Something went wrong. Please try again.";
  const raw = message.toLowerCase();

  // Our own RPC exceptions (supabase/migrations) — short lowercase Postgres
  // RAISE text, not written for a reader. Give them real sentences.
  if (raw.includes("invalid invite code")) {
    return "That invite link isn't valid anymore.";
  }
  if (raw.includes("cannot add yourself")) {
    return "That's your own invite link — share it with a friend instead.";
  }
  if (raw.includes("that request isn't there anymore")) {
    return "That request isn't there anymore.";
  }
  if (raw.includes("isn't on raven anymore")) {
    return "That account isn't on Raven anymore.";
  }
  if (raw.includes("finish signing up first")) {
    return "Finish signing up first, then try again.";
  }
  if (raw.includes("too many numbers at once")) {
    return "That's a lot of numbers at once — try again.";
  }
  if (raw.includes("not signed in")) {
    return "You'll need to sign in first.";
  }

  // Auth
  // GoTrue gives a mistyped code and a stale one the same answer.
  if (raw.includes("token has expired or is invalid")) {
    return "That code didn't work — check it, or get a new one.";
  }
  if (raw.includes("token has expired") || raw.includes("otp_expired")) {
    return "That code has expired — request a new one.";
  }
  if (raw.includes("invalid login credentials") || (raw.includes("token") && raw.includes("invalid"))) {
    return "That code didn't match — check it and try again.";
  }
  if (raw.includes("for security purposes") || raw.includes("rate limit") || raw.includes("too many requests")) {
    return "You're going a bit fast — wait a moment and try again.";
  }
  // The login and sign-up phone steps branch on these errors' codes
  // (otp_disabled, phone_exists) before they ever get here — this copy is
  // for anywhere that doesn't.
  if (raw.includes("phone number has already been registered")) {
    return "That number already has a Raven account.";
  }
  if (raw.includes("signups not allowed for otp")) {
    return "There's no Raven account with that number yet.";
  }
  // GoTrue's own E.164 check, then Twilio's verdicts on numbers it can't text.
  if (
    (raw.includes("invalid") && raw.includes("phone number")) ||
    raw.includes("not a valid phone number") ||
    raw.includes("not a valid mobile number")
  ) {
    return "That doesn't look like a valid phone number.";
  }
  if (raw.includes("sms") && (raw.includes("disabled") || raw.includes("not enabled") || raw.includes("provider"))) {
    return "Sign-in isn't available right now — try again shortly.";
  }
  // Same provider failure while texting a new number during sign-up.
  if (raw.includes("otp to provider")) {
    return "We couldn't text that number right now — try again shortly.";
  }
  if (raw.includes("user already registered")) {
    return "That number is already signed up — try signing in instead.";
  }
  if (raw.includes("unable to validate") && raw.includes("phone")) {
    return "That doesn't look like a valid phone number.";
  }
  if (raw.includes("jwt") || (raw.includes("session") && raw.includes("expired"))) {
    return "You've been signed out — sign in again.";
  }

  // Network
  if (
    raw.includes("failed to fetch") ||
    raw.includes("network request failed") ||
    raw.includes("networkerror") ||
    raw.includes("load failed")
  ) {
    return "Can't reach Raven right now — check your connection and try again.";
  }

  // Postgres / PostgREST / storage — never surface these raw
  if (raw.includes("row-level security") || raw.includes("permission denied")) {
    return "You don't have permission to do that.";
  }
  if (raw.includes("duplicate key")) {
    return "That's already done.";
  }
  if (raw.includes("violates foreign key")) {
    return "That doesn't exist anymore.";
  }
  if (raw.includes("violates check constraint") || raw.includes("invalid input syntax")) {
    return "That doesn't look right — check it and try again.";
  }
  if (raw.includes("payload too large") || raw.includes("exceeded the maximum") || raw.includes("maximum allowed size")) {
    return "That photo's too big — try a smaller one.";
  }
  if (raw.includes("mime type")) {
    return "That file type isn't supported — try a photo instead.";
  }

  return message;
}
