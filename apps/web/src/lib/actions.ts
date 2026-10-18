"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError, type RsvpStatus } from "@raven/shared";
import { createClient } from "@/lib/supabase/server";
import { getSignedInUser } from "@/lib/supabase/claims";
import { safeNext } from "@/lib/redirect";

async function requireUser() {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user) redirect("/login");
  // Middleware already holds every private page at /phone until the number
  // is verified; this covers actions posted from public ones like /j/.
  if (!user.phoneVerified) redirect("/phone");
  return { supabase, user };
}

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));
  // Only present when onboarding was pre-filled from a Google sign-in — see
  // getSessionProfile's oauthHint. Never user-editable here; they can still
  // change it afterward via the existing avatar uploader in Settings.
  const avatarUrl = formData.get("avatar_url");
  if (!displayName) return;
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    display_name: displayName,
    avatar_url: typeof avatarUrl === "string" && avatarUrl ? avatarUrl : null,
  });
  if (error && error.code !== "23505") {
    const params = new URLSearchParams({ next, error: friendlyError(error) });
    redirect(`/onboarding?${params}`);
  }
  redirect(next);
}

export async function sendRaven(input: {
  body: string;
  expiresAt: string;
  mediaUrl?: string | null;
  location?: string | null;
}) {
  const { supabase, user } = await requireUser();
  const body = input.body.trim();
  if (!body) return { error: "A raven needs a message." };
  const location = input.location?.trim() || null;

  // Every raven flies to all your friends — they decide whether to come.
  const { data: friendships, error: friendsError } = await supabase
    .from("friendships")
    .select("user_a, user_b");
  if (friendsError) return { error: friendlyError(friendsError) };
  const recipientIds = (friendships ?? []).map((f) =>
    f.user_a === user.id ? f.user_b : f.user_a,
  );
  if (recipientIds.length === 0) {
    return { error: "No one to send to yet — share your invite link first." };
  }

  const { data: raven, error } = await supabase
    .from("ravens")
    .insert({
      sender_id: user.id,
      body,
      expires_at: input.expiresAt,
      media_url: input.mediaUrl ?? null,
      location,
    })
    .select("id")
    .single();
  if (error || !raven) return { error: error ? friendlyError(error) : "Could not send." };

  const { error: recipientsError } = await supabase
    .from("raven_recipients")
    .insert(recipientIds.map((recipient_id) => ({ raven_id: raven.id, recipient_id })));
  if (recipientsError) {
    // Don't leave an addressless raven behind.
    await supabase.from("ravens").delete().eq("id", raven.id);
    return { error: friendlyError(recipientsError) };
  }

  revalidatePath("/");
  // No redirect: the compose screen finishes the glide animation, then navigates.
  return { id: raven.id };
}

export async function rsvp(ravenId: string, status: Exclude<RsvpStatus, "pending">) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("raven_recipients")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("raven_id", ravenId)
    .eq("recipient_id", user.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/");
  revalidatePath(`/r/${ravenId}`);
  return {};
}

export async function sendReply(ravenId: string, body: string, mediaUrl?: string | null) {
  const { supabase, user } = await requireUser();
  const trimmed = body.trim();
  if (!trimmed && !mediaUrl) return {};
  // Returns the inserted row: the reply thread already rendered an optimistic
  // version of it on click, and needs the real id/created_at to reconcile —
  // without this, the optimistic entry never resolves to the row the
  // realtime subscription will later recognize as "already shown".
  const { data, error } = await supabase
    .from("raven_replies")
    .insert({ raven_id: ravenId, author_id: user.id, body: trimmed, media_url: mediaUrl ?? null })
    .select()
    .single();
  if (error) return { error: friendlyError(error) };
  // No revalidatePath: the reply thread patches itself from this return
  // value and from its own scoped realtime subscription, not a server refetch.
  return { reply: data };
}

export async function recallRaven(ravenId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("ravens").delete().eq("id", ravenId);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/");
  redirect("/");
}

/** Opening someone's invite link asks them to be friends — you're friends
 *  straight away only if they'd already asked you (migration 20261014000013). */
export async function redeemInvite(code: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("redeem_invite", { code });
  if (error) {
    redirect(`/j/${code}?error=${encodeURIComponent(friendlyError(error))}`);
  }
  revalidatePath("/friends");
  redirect(data === "friends" ? "/friends?friends=1" : "/friends?asked=1");
}

export async function answerFriendRequest(requesterId: string, accept: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("answer_friend_request", {
    requester: requesterId,
    accept,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/friends");
  revalidatePath("/");
  return {};
}

export async function withdrawFriendRequest(targetId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("withdraw_friend_request", { target: targetId });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/friends");
  return {};
}

export async function setDiscoverable(discoverable: boolean) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ discoverable }).eq("id", user.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/settings");
  return {};
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const displayName = formData.get("display_name");
  if (typeof displayName !== "string" || !displayName.trim()) return;
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim() })
    .eq("id", user.id);
  if (error) redirect(`/settings?error=${encodeURIComponent(friendlyError(error))}`);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function updateAvatarUrl(avatarUrl: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/settings");
  revalidatePath("/");
  return {};
}

/** Removes the account and everything in it (migrations 20261014000011
 *  and …12). DeleteAccountButton clears the user's photos first, from the
 *  browser — they sit in Storage, outside the database's cascades, and the
 *  database refuses while any are left. */
export async function deleteAccount(): Promise<{ error: string }> {
  // Not requireUser(): a sign-up that stopped at the phone step has no
  // verified number yet, and still gets to delete itself.
  const supabase = await createClient();
  if (!(await getSignedInUser(supabase))) redirect("/login");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: friendlyError(error) };
  // Local only: the server-side session went with the account, so there's
  // nothing left for a global sign-out to revoke — just clear the cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/signup?notice=deleted");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
