import "server-only";
import { cache } from "react";
import { friendlyError, type Profile, type Raven, type RavenRecipient, type RavenReply } from "@raven/shared";
import { createClient } from "@/lib/supabase/server";

/** Logs the raw Postgres error for debugging, throws only the friendly text —
 *  this is what a Next.js error boundary would render if a page-load query fails. */
function queryFailed(context: string, error: { message: string }): never {
  console.error(`[data:${context}]`, error.message);
  throw new Error(friendlyError(error));
}

export type InboxRaven = Raven & {
  sender: Profile;
  recipients: Array<RavenRecipient & { profile: Profile | null }>;
};

/** Shared with the client-side reply thread, which needs this exact shape
 *  for both the server-fetched initial replies and the ones it patches in
 *  itself (optimistic sends, realtime-delivered rows from other people). */
export type ReplyRow = RavenReply & { author: Profile | null };

export type RavenDetail = InboxRaven & {
  replies: ReplyRow[];
};

/** Everything visible and unexpired, newest first. RLS does the privacy work:
 *  senders get every recipient row, recipients get themselves + attendees. */
export async function getInbox(): Promise<InboxRaven[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ravens")
    .select(
      "*, sender:profiles!sender_id(*), recipients:raven_recipients(*, profile:profiles!recipient_id(*))",
    )
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) queryFailed("inbox", error);
  return (data ?? []) as unknown as InboxRaven[];
}

/** Your private history: expired ravens you sent or received. The rows never
 *  leave Postgres — expiry only closes RSVPs and the chat. */
export async function getPast(limit = 50): Promise<InboxRaven[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ravens")
    .select(
      "*, sender:profiles!sender_id(*), recipients:raven_recipients(*, profile:profiles!recipient_id(*))",
    )
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(limit);
  if (error) queryFailed("past", error);
  return (data ?? []) as unknown as InboxRaven[];
}

export async function getRaven(id: string): Promise<RavenDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ravens")
    .select(
      "*, sender:profiles!sender_id(*), recipients:raven_recipients(*, profile:profiles!recipient_id(*)), replies:raven_replies(*, author:profiles!author_id(*))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) queryFailed("raven", error);
  return data as unknown as RavenDetail | null;
}

/** Cached per request: the layout's header avatar and the page underneath
 *  both ask, and share one round trip instead of making two. */
export const getSessionProfile = cache(async (): Promise<{
  userId: string;
  profile: Profile | null;
  /** Signing up is email first, then a number proven by SMS code — false
   *  for a Google/email account that hasn't finished the second step. */
  phoneVerified: boolean;
  /** Name/photo Google handed back on sign-in, for onboarding to pre-fill —
   *  a starting point the person still confirms, never written directly. */
  oauthHint: { displayName: string | null; avatarUrl: string | null } | null;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const meta = user.user_metadata ?? {};
  const oauthHint =
    user.app_metadata?.provider === "google"
      ? {
          displayName: (meta.full_name ?? meta.name ?? null) as string | null,
          avatarUrl: (meta.avatar_url ?? meta.picture ?? null) as string | null,
        }
      : null;
  return {
    userId: user.id,
    profile: data ?? null,
    phoneVerified: Boolean(user.phone_confirmed_at),
    oauthHint,
  };
});

/** How many friends the viewer has, in one request: RLS already limits
 *  friendships to the viewer's own, so there's no session lookup to wait on. */
export async function getFriendCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true });
  if (error) queryFailed("friend count", error);
  return count ?? 0;
}

/** Someone on the other end of a friend request, as my_friend_requests
 *  returns them — enough to show a face and a name. */
export type RequestPerson = Pick<Profile, "id" | "display_name" | "avatar_url" | "points">;

/** Requests waiting on you, and the ones you're waiting on (migration
 *  20261014000013). Outgoing never says whether they've been declined. */
export async function getFriendRequests(): Promise<{
  incoming: RequestPerson[];
  outgoing: RequestPerson[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_friend_requests");
  if (error) queryFailed("friend requests", error);
  const rows = data ?? [];
  const person = ({ id, display_name, avatar_url, points }: (typeof rows)[number]) => ({
    id,
    display_name,
    avatar_url,
    points,
  });
  return {
    incoming: rows.filter((row) => row.direction === "incoming").map(person),
    outgoing: rows.filter((row) => row.direction === "outgoing").map(person),
  };
}

/** Friends with a raven out right now, each mapped to their newest one.
 *  RLS only shows ravens you sent or were sent, and a recalled raven is
 *  deleted outright — so "someone else's, not yet expired" is exactly the
 *  friends' ravens still flying to you. */
export async function getActiveFriendRavens(viewerId: string): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ravens")
    .select("id, sender_id")
    .neq("sender_id", viewerId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) queryFailed("active friend ravens", error);
  const newest = new Map<string, string>();
  for (const raven of data ?? []) {
    if (!newest.has(raven.sender_id)) newest.set(raven.sender_id, raven.id);
  }
  return newest;
}

export async function getFriends(userId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("friendships")
    .select("user_a, user_b, a:profiles!user_a(*), b:profiles!user_b(*)")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (error) queryFailed("friends", error);
  const rows = (data ?? []) as unknown as Array<{
    user_a: string;
    user_b: string;
    a: Profile;
    b: Profile;
  }>;
  return rows
    .map((row) => (row.user_a === userId ? row.b : row.a))
    .sort((x, y) => x.display_name.localeCompare(y.display_name));
}

