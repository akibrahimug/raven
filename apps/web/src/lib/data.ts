import "server-only";
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

export async function getSessionProfile(): Promise<{ userId: string; profile: Profile | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { userId: user.id, profile: data ?? null };
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

