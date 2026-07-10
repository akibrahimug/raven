/**
 * Dev seed: makes all five test users friends with each other, gives them
 * names, and sends a few live ravens so every account's inbox has incoming
 * ravens to accept or decline. Nobody gets a photo, so you can see the
 * initials fallback avatars in action too.
 *
 * Run: node scripts/seed-dev.mjs   (requires `supabase start`)
 * Test users: 07700 900001-5, OTP 123456.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const USERS = [
  { phone: "+447700900001", name: "AK" },
  { phone: "+447700900002", name: "Tom" },
  { phone: "+447700900003", name: "Jess" },
  { phone: "+447700900004", name: "Maya" },
  { phone: "+447700900005", name: "Dev" },
];

async function signIn(phone) {
  const supabase = createClient(URL, ANON, { auth: { persistSession: false } });
  await supabase.auth.signInWithOtp({ phone });
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (error) throw new Error(`${phone}: ${error.message}`);
  return { supabase, user: data.user };
}

const sessions = [];
for (const spec of USERS) {
  const session = await signIn(spec.phone);
  const { error } = await session.supabase
    .from("profiles")
    .insert({ id: session.user.id, display_name: spec.name });
  if (error && error.code !== "23505") throw new Error(`${spec.name}: ${error.message}`);
  sessions.push({ ...spec, ...session });
  console.log(`signed in ${spec.name}`);
}

// Everyone befriends everyone.
for (const a of sessions) {
  const { data } = await a.supabase
    .from("profiles")
    .select("invite_code")
    .eq("id", a.user.id)
    .single();
  for (const b of sessions) {
    if (b === a) continue;
    await b.supabase.rpc("redeem_invite", { code: data.invite_code });
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

console.log("\nSeeded. Sign in as any of 07700 900001-5 (code 123456) and the inbox is alive.");
