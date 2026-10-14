"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyError, type RsvpStatus } from "@raven/shared";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Middleware already holds every private page at /phone until the number
  // is verified; this covers actions posted from public ones like /j/.
  if (!user.phone_confirmed_at) redirect("/phone");
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

export async function redeemInvite(code: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("redeem_invite", { code });
  if (error) {
    redirect(`/j/${code}?error=${encodeURIComponent(friendlyError(error))}`);
  }
  revalidatePath("/friends");
  redirect("/friends?added=1");
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
