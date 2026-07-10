import { friendlyError, type Profile, type Raven, type RavenRecipient, type RavenReply, type RsvpStatus } from "@raven/shared";
import { supabase } from "./supabase";

/** Query strings mirror apps/web/src/lib/data.ts — keep both in sync. */

export type InboxRaven = Raven & {
  sender: Profile;
  recipients: Array<RavenRecipient & { profile: Profile | null }>;
};

export type RavenDetail = InboxRaven & {
  replies: Array<RavenReply & { author: Profile | null }>;
};

const INBOX_SELECT =
  "*, sender:profiles!sender_id(*), recipients:raven_recipients(*, profile:profiles!recipient_id(*))";

export async function fetchInbox(past = false): Promise<InboxRaven[]> {
  const now = new Date().toISOString();
  let query = supabase.from("ravens").select(INBOX_SELECT);
  query = past
    ? query.lte("expires_at", now).order("expires_at", { ascending: false }).limit(50)
    : query.gt("expires_at", now).order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return (data ?? []) as unknown as InboxRaven[];
}

export async function fetchRaven(id: string): Promise<RavenDetail | null> {
  const { data, error } = await supabase
    .from("ravens")
    .select(`${INBOX_SELECT}, replies:raven_replies(*, author:profiles!author_id(*))`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(friendlyError(error));
  return data as unknown as RavenDetail | null;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function createProfile(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, display_name: displayName });
  if (error && error.code !== "23505") throw new Error(friendlyError(error));
}

export async function fetchFriends(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_a, user_b, a:profiles!user_a(*), b:profiles!user_b(*)");
  if (error) throw new Error(friendlyError(error));
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

export async function rsvp(ravenId: string, userId: string, status: Exclude<RsvpStatus, "pending">) {
  const { error } = await supabase
    .from("raven_recipients")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("raven_id", ravenId)
    .eq("recipient_id", userId);
  if (error) throw new Error(friendlyError(error));
}

export async function sendReply(
  ravenId: string,
  userId: string,
  body: string,
  mediaUrl?: string | null,
) {
  const { error } = await supabase.from("raven_replies").insert({
    raven_id: ravenId,
    author_id: userId,
    body: body.trim(),
    media_url: mediaUrl ?? null,
  });
  if (error) throw new Error(friendlyError(error));
}

/** Every raven flies to all friends — same rule as the web app. */
export async function sendRaven(
  userId: string,
  body: string,
  expiresAt: string,
  mediaUrl?: string | null,
) {
  const friends = await fetchFriends(userId);
  if (friends.length === 0) throw new Error("No one to send to yet — add a friend first.");
  const { data: raven, error } = await supabase
    .from("ravens")
    .insert({ sender_id: userId, body: body.trim(), expires_at: expiresAt, media_url: mediaUrl ?? null })
    .select("id")
    .single();
  if (error || !raven) throw new Error(error ? friendlyError(error) : "Could not send.");
  const { error: recipientsError } = await supabase
    .from("raven_recipients")
    .insert(friends.map((friend) => ({ raven_id: raven.id, recipient_id: friend.id })));
  if (recipientsError) {
    await supabase.from("ravens").delete().eq("id", raven.id);
    throw new Error(friendlyError(recipientsError));
  }
  return raven.id;
}
