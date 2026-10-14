/**
 * Dev seed: makes all five test users friends with each other, gives them
 * names, and sends a few live ravens so every account's inbox has incoming
 * ravens to accept or decline. Nobody gets a photo, so you can see the
 * initials fallback avatars in action too.
 *
 * Run: node scripts/seed-dev.mjs   (requires `supabase start`)
 * Test users sign up the way everyone does — email, then a phone number —
 * and log back in with 01632 960001-5, OTP 123456.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const USERS = [
  { email: "ak@raven.test", phone: "+441632960001", name: "AK" },
  { email: "tom@raven.test", phone: "+441632960002", name: "Tom" },
  { email: "jess@raven.test", phone: "+441632960003", name: "Jess" },
  { email: "maya@raven.test", phone: "+441632960004", name: "Maya" },
  { email: "dev@raven.test", phone: "+441632960005", name: "Dev" },
];
const PASSWORD = "raven-local-only";

// Email first, then the number, verified by code: the local stack confirms
// emails on the spot and never really texts ([auth.sms.test_otp]).
// A re-run logs straight back in.
async function signUp(email, phone) {
  const supabase = createClient(URL, ANON, { auth: { persistSession: false } });
  let { data, error } = await supabase.auth.signUp({ email, password: PASSWORD });
  if (error?.code === "user_already_exists") {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD }));
  }
  if (error) throw new Error(`${email}: ${error.message}`);
  let user = data.user;
  if (!user.phone_confirmed_at) {
    const { error: phoneError } = await supabase.auth.updateUser({ phone });
    if (phoneError) throw new Error(`${phone}: ${phoneError.message}`);
    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: "123456",
      type: "phone_change",
    });
    if (verifyError) throw new Error(`verify ${phone}: ${verifyError.message}`);
    user = verified.user;
  }
  return { supabase, user };
}

const sessions = [];
for (const spec of USERS) {
  const session = await signUp(spec.email, spec.phone);
  const { error } = await session.supabase
    .from("profiles")
    .insert({ id: session.user.id, display_name: spec.name });
  if (error && error.code !== "23505") throw new Error(`${spec.name}: ${error.message}`);
  sessions.push({ ...spec, ...session });
  console.log(`signed in ${spec.name}`);
}

// Everyone befriends everyone: two people asking each other are friends
// straight away (migration 20261014000013). Re-runs are no-ops.
for (const [i, a] of sessions.entries()) {
  for (const b of sessions.slice(i + 1)) {
    await a.supabase.rpc("request_friend", { target: b.user.id });
    await b.supabase.rpc("request_friend", { target: a.user.id });
  }
}
console.log("all five are friends now");

async function send(from, body, hours) {
  const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
  const { data: raven, error } = await from.supabase
    .from("ravens")
    .insert({ sender_id: from.user.id, body, expires_at: expiresAt })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const others = sessions.filter((s) => s !== from);
  await from.supabase
    .from("raven_recipients")
    .insert(others.map((s) => ({ raven_id: raven.id, recipient_id: s.user.id })));
  console.log(`${from.name} sent: "${body}"`);
  return raven.id;
}

const [ak, tom, , maya] = sessions;
const pubRaven = await send(ak, "At The Perseverance for a couple of hours if anyone's nearby.", 3);
await send(tom, "Five-a-side tonight at 7. Need two more.", 6);
await send(maya, "Working from Kaffeine this afternoon if anyone wants to join.", 4);

// A bit of life on AK's raven: Tom's in and says so.
await tom.supabase
  .from("raven_recipients")
  .update({ status: "in", responded_at: new Date().toISOString() })
  .eq("raven_id", pubRaven)
  .eq("recipient_id", tom.user.id);
await tom.supabase
  .from("raven_replies")
  .insert({ raven_id: pubRaven, author_id: tom.user.id, body: "Save me a stool 🍺" });

console.log("\nSeeded. Log in as any of 01632 960001-5 (code 123456) and the inbox is alive.");
