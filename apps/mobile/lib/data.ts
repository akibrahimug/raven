import {
  friendlyError,
  type ContactMatch,
  type FriendStatus,
  type Profile,
  type Raven,
  type RavenRecipient,
  type RavenReply,
  type RsvpStatus,
} from "@raven/shared";
import { supabase } from "./supabase";

/** Query strings mirror apps/web/src/lib/data.ts — keep both in sync. */

export type InboxRaven = Raven & {
  sender: Profile;
  recipients: Array<RavenRecipient & { profile: Profile | null }>;
};

/** Shared with RavenScreen's live-patched reply state — see the web
 *  equivalent (apps/web/src/lib/data.ts ReplyRow) for why this exact shape
 *  matters: both the server-fetched initial replies and the ones patched in
 *  later (optimistic sends, realtime rows) need to match it. */
export type ReplyRow = RavenReply & { author: Profile | null };

export type RavenDetail = InboxRaven & {
  replies: ReplyRow[];
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

export async function createProfile(
  userId: string,
  displayName: string,
  avatarUrl?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, display_name: displayName, avatar_url: avatarUrl ?? null });
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

/** Returns the inserted row: RavenScreen renders an optimistic version of it
 *  on submit and needs the real id/created_at back to reconcile — without
 *  this, the optimistic bubble never resolves into the row the realtime
 *  subscription will later recognize as "already shown". */
export async function sendReply(
  ravenId: string,
  userId: string,
  body: string,
  mediaUrl?: string | null,
): Promise<ReplyRow> {
  const { data, error } = await supabase
    .from("raven_replies")
    .insert({
      raven_id: ravenId,
      author_id: userId,
      body: body.trim(),
      media_url: mediaUrl ?? null,
    })
    .select("*, author:profiles!author_id(*)")
    .single();
  if (error || !data) throw new Error(error ? friendlyError(error) : "Could not send.");
  return data as unknown as ReplyRow;
}

/** Every raven flies to all friends — same rule as the web app. */
export async function sendRaven(
  userId: string,
  body: string,
  expiresAt: string,
  mediaUrl?: string | null,
  location?: string | null,
) {
  const friends = await fetchFriends(userId);
  if (friends.length === 0) throw new Error("No one to send to yet — add a friend first.");
  const { data: raven, error } = await supabase
    .from("ravens")
    .insert({
      sender_id: userId,
      body: body.trim(),
      expires_at: expiresAt,
      media_url: mediaUrl ?? null,
      location: location?.trim() || null,
    })
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

/** Removes the account and everything in it — mirrors the web's
 *  deleteOwnPhotos + deleteAccount (apps/web/src/lib/storage.ts, actions.ts)
 *  and migrations 20261014000011/12. Photos go first: they sit in Storage,
 *  outside the database's cascades, and the database refuses while any are
 *  left. One request per file — the live server's Oracle Object Storage
 *  rejects the bulk delete supabase-js sends ("Missing required header:
 *  Content-MD5…") — a few at a time. */
export async function deleteAccount(userId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You've been signed out — sign in again.");
  const base = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/raven-media/${userId}`;
  const headers = {
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${session.access_token}`,
  };
  for (let page = 0; ; page++) {
    if (page === 100) throw new Error("Couldn't delete your photos — try again.");
    const { data: files, error } = await supabase.storage.from("raven-media").list(userId, { limit: 100 });
    if (error) throw new Error(friendlyError(error));
    if (!files.length) break;
    for (let i = 0; i < files.length; i += 5) {
      const responses = await Promise.all(
        files
          .slice(i, i + 5)
          .map((file) => fetch(`${base}/${encodeURIComponent(file.name)}`, { method: "DELETE", headers })),
      );
      if (responses.some((response) => !response.ok)) {
        throw new Error("Couldn't delete your photos — try again.");
      }
    }
  }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(friendlyError(error));
}

/** Someone on the other end of a friend request. */
export type RequestPerson = Pick<Profile, "id" | "display_name" | "avatar_url" | "points">;

/** Requests waiting on you, and the ones you're waiting on — mirrors
 *  getFriendRequests in apps/web/src/lib/data.ts (migration 20261014000013).
 *  Outgoing never says whether they've been declined. */
export async function fetchFriendRequests(): Promise<{
  incoming: RequestPerson[];
  outgoing: RequestPerson[];
}> {
  const { data, error } = await supabase.rpc("my_friend_requests");
  if (error) throw new Error(friendlyError(error));
  const rows = (data ?? []) as Array<RequestPerson & { direction: string }>;
  const person = ({ id, display_name, avatar_url, points }: RequestPerson) => ({
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

/** Asks someone to be friends; "friends" if they'd already asked you. */
export async function requestFriend(targetId: string): Promise<FriendStatus> {
  const { data, error } = await supabase.rpc("request_friend", { target: targetId });
  if (error) throw new Error(friendlyError(error));
  return data === "friends" ? "friends" : "requested";
}

export async function answerFriendRequest(requesterId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("answer_friend_request", { requester: requesterId, accept });
  if (error) throw new Error(friendlyError(error));
}

export async function withdrawFriendRequest(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("withdraw_friend_request", { target: targetId });
  if (error) throw new Error(friendlyError(error));
}

/** Which of these E.164 numbers are on Raven. The server takes 2,000 at a
 *  time and keeps none of them. */
export async function matchContacts(phones: string[]): Promise<ContactMatch[]> {
  const matches: ContactMatch[] = [];
  for (let i = 0; i < phones.length; i += 2000) {
    const { data, error } = await supabase.rpc("match_contacts", { phones: phones.slice(i, i + 2000) });
    if (error) throw new Error(friendlyError(error));
    matches.push(...((data ?? []) as ContactMatch[]));
  }
  return matches;
}

export async function setDiscoverable(userId: string, discoverable: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ discoverable }).eq("id", userId);
  if (error) throw new Error(friendlyError(error));
}
