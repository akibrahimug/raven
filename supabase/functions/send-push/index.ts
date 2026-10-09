// Sends Expo push notifications for raven events.
//
// NOT CURRENTLY DEPLOYED: the self-hosted stack's trimmed shape (Oracle
// E2.1.Micro) has no Edge Functions container, so as of
// 20261009000008_push_direct_expo.sql the triggers call Expo directly via
// pg_net instead of this function — see that migration for why and what
// changed. Kept here, unmodified, as the richer alternative for a bigger
// box: this version reads Expo's response and prunes dead tokens, which the
// direct-pg_net path can't do (pg_net is fire-and-forget; nothing reads the
// response back). To revive it: deploy with --no-verify-jwt, set the
// push_fn_url/push_fn_secret Vault secrets and PUSH_SECRET function secret,
// and move the trigger functions back to calling notify_push() (restore
// from 20260710000006_push.sql) instead of send_expo_push().
//
// Invoked by database triggers via pg_net when deployed; authenticated by
// the x-push-secret header.
import { createClient } from "npm:@supabase/supabase-js@2";

type PushEvent =
  | { event: "raven_sent"; raven_id: string; recipient_ids: string[] }
  | {
      event: "reply";
      raven_id: string;
      reply_id: string;
      author_id: string;
      body: string;
      has_media: boolean;
    }
  | { event: "rsvp"; raven_id: string; recipient_id: string; status: "in" | "late" };

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function displayNames(ids: string[]): Promise<Map<string, string>> {
  const { data } = await db.from("profiles").select("id, display_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const evt = (await req.json()) as PushEvent;

  const { data: raven } = await db
    .from("ravens")
    .select("id, sender_id, body")
    .eq("id", evt.raven_id)
    .maybeSingle();
  if (!raven) return json({ sent: 0, reason: "raven gone" }); // recalled already

  let audience: string[] = [];
  let title = "";
  let body = "";

  if (evt.event === "raven_sent") {
    audience = evt.recipient_ids;
    const names = await displayNames([raven.sender_id]);
    title = names.get(raven.sender_id) ?? "A friend";
    body = truncate(raven.body);
  } else if (evt.event === "reply") {
    // Thread audience: sender + attending recipients, minus whoever wrote it.
    const { data: attending } = await db
      .from("raven_recipients")
      .select("recipient_id")
      .eq("raven_id", raven.id)
      .in("status", ["in", "late"]);
    audience = [raven.sender_id, ...(attending ?? []).map((r) => r.recipient_id)]
      .filter((id) => id !== evt.author_id);
    const names = await displayNames([evt.author_id]);
    title = `${names.get(evt.author_id) ?? "Someone"} · ${truncate(raven.body, 40)}`;
    body = evt.body ? truncate(evt.body) : "Sent a photo";
  } else if (evt.event === "rsvp") {
    audience = [raven.sender_id];
    const names = await displayNames([evt.recipient_id]);
    const name = names.get(evt.recipient_id) ?? "Someone";
    title = evt.status === "in" ? `${name} is in` : `${name} is running late`;
    body = truncate(raven.body);
  }

  audience = [...new Set(audience)];
  if (audience.length === 0) return json({ sent: 0 });

  const { data: tokens } = await db
    .from("push_tokens")
    .select("token")
    .in("user_id", audience);
  if (!tokens || tokens.length === 0) return json({ sent: 0 });

  const messages = tokens.map(({ token }) => ({
    to: token,
    title,
    body,
    data: { ravenId: raven.id },
    sound: "default",
    channelId: "default",
  }));

  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    const { data: tickets } = await res.json().catch(() => ({ data: [] }));
    (tickets ?? []).forEach((ticket: { status: string; details?: { error?: string } }, i2: number) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        dead.push(chunk[i2].to);
      }
    });
  }
  if (dead.length > 0) {
    await db.from("push_tokens").delete().in("token", dead);
  }

  return json({ sent: messages.length - dead.length });
});
