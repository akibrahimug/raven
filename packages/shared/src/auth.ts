/** Ofcom keeps 07700 900000–900999 for TV and film, so no real phone has
 *  one. The live server's test logins sit in that range with a code that
 *  never changes, which proves nothing about who's signing up — they can
 *  still open the test accounts that exist, but never start a new one. The
 *  database holds the same line (has_verified_phone, migration
 *  20261014000010); this check just says so before a code is sent. */
export function isTestNumber(e164: string): boolean {
  return e164.startsWith("+447700900");
}

/** Shown after a hand-off between logging in and signing up — logging in
 *  never makes an account (signing up starts with email, then the number),
 *  and a number belongs to exactly one account — or after deleting one. */
export const AUTH_NOTICES = {
  "no-account":
    "There's no Raven account with that number yet. Sign up below — you'll add your number right after.",
  taken: "That number already has a Raven account — log in with it here.",
  deleted: "Your account has been deleted, along with everything in it.",
} as const;

export type AuthNotice = keyof typeof AUTH_NOTICES;
