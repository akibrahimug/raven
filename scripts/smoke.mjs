/**
 * End-to-end smoke test against the local Supabase stack.
 * Exercises the full social model with three test users and asserts the
 * RLS privacy rules hold:
 *   - recipients see who's in, never pending/declined co-recipients
 *   - reply threads are sender + attending only
 *   - non-participants see nothing
 *
 * Run: node scripts/smoke.mjs   (requires `supabase start`)
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

let failed = false;
function check(condition, label) {
  console.log(`${condition ? "ok  " : "FAIL"}  ${label}`);
  if (!condition) failed = true;
}

const PASSWORD = "raven-local-only";

function client() {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

// Email first, then the number, verified by code: the local stack confirms
// emails on the spot and never really texts ([auth.sms.test_otp]).
async function signUp(email, phone) {
  const supabase = client();
  const { data, error } = await supabase.auth.signUp({ email, password: PASSWORD });
  if (error) throw new Error(`sign up ${email}: ${error.message}`);
  const { error: phoneError } = await supabase.auth.updateUser({ phone });
  if (phoneError) throw new Error(`add ${phone}: ${phoneError.message}`);
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    phone,
    token: "123456",
    type: "phone_change",
  });
  if (verifyError) throw new Error(`verify ${phone}: ${verifyError.message}`);
  return { supabase, user: verified.user ?? data.user };
}

// Three test users from supabase/config.toml [auth.sms.test_otp]
const ak = await signUp("ak@raven.test", "+441632960001");
const tom = await signUp("tom@raven.test", "+441632960002");
const jess = await signUp("jess@raven.test", "+441632960003");

for (const [session, name] of [
  [ak, "AK"],
  [tom, "Tom"],
  [jess, "Jess"],
]) {
  const { error } = await session.supabase
    .from("profiles")
    .insert({ id: session.user.id, display_name: name });
  if (error && error.code !== "23505") throw new Error(`profile ${name}: ${error.message}`);
}

// Friendships via AK's invite link (Tom and Jess are NOT friends with each other)
const { data: akProfile } = await ak.supabase
  .from("profiles")
  .select("invite_code")
  .eq("id", ak.user.id)
  .single();
for (const session of [tom, jess]) {
  const { error } = await session.supabase.rpc("redeem_invite", { code: akProfile.invite_code });
  if (error) throw new Error(`redeem_invite: ${error.message}`);
}
const { data: akFriendships } = await ak.supabase.from("friendships").select("*");
check(akFriendships.length >= 2, "invite links created both friendships");

// AK sends a raven to Tom + Jess
const { data: raven, error: ravenError } = await ak.supabase
  .from("ravens")
  .insert({
    sender_id: ak.user.id,
    body: "At The Perseverance for a couple of hours if anyone's nearby.",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  })
  .select("id")
  .single();
if (ravenError) throw new Error(`send raven: ${ravenError.message}`);
const { error: addressError } = await ak.supabase.from("raven_recipients").insert([
  { raven_id: raven.id, recipient_id: tom.user.id },
  { raven_id: raven.id, recipient_id: jess.user.id },
]);
if (addressError) throw new Error(`address raven: ${addressError.message}`);

const { data: tomInbox } = await tom.supabase
  .from("ravens")
  .select("id, sender:profiles!sender_id(display_name)")
  .eq("id", raven.id);
check(tomInbox?.[0]?.sender?.display_name === "AK", "Tom receives AK's raven");

// Before anyone responds, Tom sees only his own recipient row
const { data: tomRowsBefore } = await tom.supabase
  .from("raven_recipients")
  .select("recipient_id")
  .eq("raven_id", raven.id);
check(
  tomRowsBefore.length === 1 && tomRowsBefore[0].recipient_id === tom.user.id,
  "pending co-recipients are hidden from Tom",
);

const { data: tomBefore } = await tom.supabase
  .from("profiles")
  .select("points")
  .eq("id", tom.user.id)
  .single();

// Tom is in; Jess can't make it
const { error: rsvpError } = await tom.supabase
  .from("raven_recipients")
  .update({ status: "in", responded_at: new Date().toISOString() })
  .eq("raven_id", raven.id)
  .eq("recipient_id", tom.user.id);
check(!rsvpError, "Tom RSVPs I'm in");
await jess.supabase
  .from("raven_recipients")
  .update({ status: "cant", responded_at: new Date().toISOString() })
  .eq("raven_id", raven.id)
  .eq("recipient_id", jess.user.id);

// Rewards: accepting earned Tom 10 points, visible to his friend AK
const { data: tomSeenByAk } = await ak.supabase
  .from("profiles")
  .select("points")
  .eq("id", tom.user.id)
  .single();
check(tomSeenByAk.points === tomBefore.points + 10, "accepting a raven earns 10 points");
const { error: selfPointsError } = await tom.supabase
  .from("profiles")
  .update({ points: 99999 })
  .eq("id", tom.user.id);
check(!!selfPointsError, "points cannot be self-assigned");
const { error: avatarUrlError } = await tom.supabase
  .from("profiles")
  .update({ avatar_url: "https://example.test/raven-media/tom-avatar.jpg" })
  .eq("id", tom.user.id);
check(!avatarUrlError, "avatar photo is user-editable in settings");

const { data: jessRows } = await jess.supabase
  .from("raven_recipients")
  .select("recipient_id, status")
  .eq("raven_id", raven.id);
check(
  jessRows.some((r) => r.recipient_id === tom.user.id && r.status === "in"),
  "Jess sees that Tom is in (social proof)",
);
const { data: tomRowsAfter } = await tom.supabase
  .from("raven_recipients")
  .select("recipient_id")
  .eq("raven_id", raven.id);
check(
  !tomRowsAfter.some((r) => r.recipient_id === jess.user.id),
  "Jess's decline stays hidden from Tom",
);
const { data: akRows } = await ak.supabase
  .from("raven_recipients")
  .select("recipient_id")
  .eq("raven_id", raven.id);
check(akRows.length === 2, "sender sees every response");

// Thread: sender + attending only
const { error: tomReplyError } = await tom.supabase
  .from("raven_replies")
  .insert({ raven_id: raven.id, author_id: tom.user.id, body: "Which end of the bar?" });
check(!tomReplyError, "Tom (in) can reply");
const { error: photoOnlyError } = await tom.supabase.from("raven_replies").insert({
  raven_id: raven.id,
  author_id: tom.user.id,
  body: "",
  media_url: "https://example.test/raven-media/fake.jpg",
});
check(!photoOnlyError, "photo-only replies are allowed");
const { error: emptyReplyError } = await tom.supabase
  .from("raven_replies")
  .insert({ raven_id: raven.id, author_id: tom.user.id, body: "" });
check(!!emptyReplyError, "completely empty replies are rejected");
const { error: jessReplyError } = await jess.supabase
  .from("raven_replies")
  .insert({ raven_id: raven.id, author_id: jess.user.id, body: "should not land" });
check(!!jessReplyError, "Jess (can't) is blocked from replying");
const { data: jessReplies } = await jess.supabase
  .from("raven_replies")
  .select("id")
  .eq("raven_id", raven.id);
check(jessReplies.length === 0, "thread is hidden from Jess");
const { data: akReplies } = await ak.supabase
  .from("raven_replies")
  .select("body, author:profiles!author_id(display_name)")
  .eq("raven_id", raven.id);
check(
  akReplies.length >= 1 && akReplies.every((r) => r.author?.display_name === "Tom"),
  "AK reads Tom's reply",
);

// Profile visibility: Tom and Jess share only this raven; Jess declined,
// so her profile should stay invisible to Tom.
const { data: tomVisibleProfiles } = await tom.supabase.from("profiles").select("display_name");
check(
  !tomVisibleProfiles.some((p) => p.display_name === "Jess"),
  "declined co-recipient's profile stays invisible",
);

// A raven can't be addressed to a non-friend (Tom -> Jess)
const { data: tomRaven } = await tom.supabase
  .from("ravens")
  .insert({
    sender_id: tom.user.id,
    body: "Court booked Saturday 10:00. One spare spot.",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  })
  .select("id")
  .single();
const { error: nonFriendError } = await tom.supabase
  .from("raven_recipients")
  .insert([{ raven_id: tomRaven.id, recipient_id: jess.user.id }]);
check(!!nonFriendError, "ravens cannot be sent to non-friends");
await tom.supabase.from("ravens").delete().eq("id", tomRaven.id);

// Signing up is email first, then a number proven by SMS code; logging in
// never makes an account (migration 20261014000010).
const stranger = client();
const { error: phoneOnlyError } = await stranger.auth.signInWithOtp({ phone: "+441632960004" });
const { error: unknownLoginError } = await stranger.auth.signInWithOtp({
  phone: "+441632960004",
  options: { shouldCreateUser: false },
});
check(
  !!phoneOnlyError && unknownLoginError?.code === "otp_disabled",
  "nobody signs up with just a phone number",
);

const newcomer = client();
const { data: newcomerSignUp } = await newcomer.auth.signUp({
  email: `newcomer-${Date.now()}@raven.test`,
  password: PASSWORD,
});
const { error: earlyProfileError } = await newcomer
  .from("profiles")
  .insert({ id: newcomerSignUp.user.id, display_name: "Too soon" });
check(!!earlyProfileError, "no profile until a phone number is verified");

const { error: takenError } = await newcomer.auth.updateUser({ phone: "+441632960001" });
check(takenError?.code === "phone_exists", "a phone number belongs to one account");

const { data: pending } = await newcomer.auth.updateUser({ phone: "+441632960005" });
check(!pending.user?.phone_confirmed_at, "a new number waits for its SMS code");

// GoTrue matches a phone-change code to the first account it finds with the
// number pending, so an abandoned sign-up mustn't shadow a newer one.
const abandoned = client();
await abandoned.auth.signUp({ email: `abandoned-${Date.now()}@raven.test`, password: PASSWORD });
await abandoned.auth.updateUser({ phone: "+441632960004" });
const retry = client();
const retryEmail = `retry-${Date.now()}@raven.test`;
const { data: retrySignUp } = await retry.auth.signUp({ email: retryEmail, password: PASSWORD });
await retry.auth.updateUser({ phone: "+441632960004" });
const { data: retryVerified } = await retry.auth.verifyOtp({
  phone: "+441632960004",
  token: "123456",
  type: "phone_change",
});
check(retryVerified.user?.id === retrySignUp.user.id, "the latest code request for a number wins");

// A fresh account: a second number on the first would trip the SMS throttle.
const tester = client();
const { data: testerSignUp } = await tester.auth.signUp({
  email: `tester-${Date.now()}@raven.test`,
  password: PASSWORD,
});
const { error: testRangeAddError } = await tester.auth.updateUser({ phone: "+447700900001" });
const { error: testRangeCodeError } = await tester.auth.verifyOtp({
  phone: "+447700900001",
  token: "123456",
  type: "phone_change",
});
const { error: testRangeProfileError } = await tester
  .from("profiles")
  .insert({ id: testerSignUp.user.id, display_name: "Test range" });
check(
  !testRangeAddError && !testRangeCodeError && !!testRangeProfileError,
  "a 07700 900xxx test number can't start an account",
);

// Deleting an account takes everything with it (migration 20261014000011):
// profile, friendships, the ravens it sent, its photos, and the login itself.
// "retry" above finished verifying its number, so it can have a profile.
const leaverId = retrySignUp.user.id;
const { data: leaverProfile } = await retry
  .from("profiles")
  .insert({ id: leaverId, display_name: "Leaver" })
  .select("invite_code")
  .single();
await ak.supabase.rpc("redeem_invite", { code: leaverProfile.invite_code });
const { data: leaverRaven } = await retry
  .from("ravens")
  .insert({
    sender_id: leaverId,
    body: "Last one out.",
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  })
  .select("id")
  .single();
await retry.from("raven_recipients").insert({ raven_id: leaverRaven.id, recipient_id: ak.user.id });
const media = retry.storage.from("raven-media");
await media.upload(`${leaverId}/smoke.png`, new Uint8Array([137, 80, 78, 71]), {
  contentType: "image/png",
});
const { data: akSawRaven } = await ak.supabase.from("ravens").select("id").eq("id", leaverRaven.id);

// The same steps as Settings → Delete account: photos first, then the rest.
const { data: leaverFiles } = await media.list(leaverId);
await media.remove(leaverFiles.map((file) => `${leaverId}/${file.name}`));
const { error: deleteError } = await retry.rpc("delete_my_account");

const { data: akSeesRaven } = await ak.supabase.from("ravens").select("id").eq("id", leaverRaven.id);
const { data: akFriendsAfter } = await ak.supabase.from("friendships").select("user_a, user_b");
check(
  !deleteError &&
    akSawRaven.length === 1 &&
    akSeesRaven.length === 0 &&
    !akFriendsAfter.some((f) => f.user_a === leaverId || f.user_b === leaverId),
  "deleting an account removes its profile, friendships and ravens",
);
const { data: filesAfter } = await client().storage.from("raven-media").list(leaverId);
check(leaverFiles.length === 1 && filesAfter.length === 0, "deleting an account removes its photos");
const { error: comebackError } = await client().auth.signInWithPassword({
  email: retryEmail,
  password: PASSWORD,
});
check(!!comebackError, "a deleted account can't sign back in");

console.log(failed ? "\nSMOKE FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
