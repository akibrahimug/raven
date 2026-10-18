import type { SupabaseClient } from "@supabase/supabase-js";

/** Who's signed in, read from the session's own access token. */
export type SignedInUser = {
  id: string;
  /** Set only once the number is proven by SMS code — GoTrue moves a pending
   *  number into `phone` when it's verified, never before. */
  phoneVerified: boolean;
  provider: string | null;
  userMetadata: Record<string, unknown>;
};

/** The signed-in user, or null — without a round trip to the auth server.
 *  This server signs sessions with an asymmetric key (ES256), so getClaims()
 *  checks the token's signature against the published public key (fetched
 *  once, cached ten minutes) instead of asking GoTrue on every request the
 *  way getUser() does — that call took 0.3–0.9s on this box, and every
 *  page, prefetch and action used to make it, often several at once. It
 *  still refreshes an expired session first, same as getUser(). What the
 *  user can read and write is unchanged: RLS checks the same token. */
export async function getSignedInUser(supabase: SupabaseClient): Promise<SignedInUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    phoneVerified: Boolean(claims.phone),
    provider: (claims.app_metadata?.provider as string | undefined) ?? null,
    userMetadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
}
