-- Push notifications, take two: call Expo directly instead of via an Edge
-- Function. The trimmed self-hosted stack (Oracle E2.1.Micro, see
-- self-host-infra README) has no functions container, so `notify_push`'s
-- Vault-secret-gated call to a `send-push` Edge Function has been silently
-- no-op'ing since launch — accepted at the time as "push is inert", not
-- something that broke anything else.
--
-- pg_net's net.http_post is fire-and-forget: it queues the request and
-- returns immediately, with the actual response landing in a background
-- worker's net._http_response table, not in this transaction. The old
-- two-hop design (trigger -> pg_net -> Edge Function -> Expo) relied on the
-- Edge Function's synchronous Deno runtime to build the Expo payload *and*
-- read Expo's response to prune dead tokens. Collapsing to one hop
-- (trigger -> pg_net -> Expo) keeps the payload-building half (it was never
-- more than string formatting and a couple of joins) but drops the
-- dead-token cleanup: there's nowhere left to read Expo's response from.
-- Stale tokens are harmless rather than silently broken — Expo just
-- rejects them one send at a time — and register_push_token already
-- replaces a token's row whenever its device re-registers (the "device
-- changed hands" case the original comment called out). Revisit with a
-- pg_cron sweep of net._http_response if volume ever makes it worth it.

-- ---------------------------------------------------------------- helpers

-- Named push_truncate, not truncate, so it reads unambiguously next to the
-- TRUNCATE statement and never gets mistaken for one.
create or replace function public.push_truncate(t text, max_len int default 120)
returns text
language sql
immutable
as $$
  select case
    when char_length(t) > max_len then left(t, max_len - 1) || '…'
    else t
  end;
$$;

-- Builds one Expo push message per registered device across the audience
-- and posts them to Expo's HTTP API, chunked at 100 per Expo's own limit.
-- Security definer + no grants: callable only from the trigger functions
-- below, same boundary the old notify_push enforced.
create or replace function public.send_expo_push(
  p_audience uuid[],
  p_title text,
  p_body text,
  p_raven_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  all_messages jsonb;
  chunk jsonb;
  i int := 0;
  n int;
begin
  if p_audience is null or array_length(p_audience, 1) is null then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', pt.token,
    'title', p_title,
    'body', p_body,
    'sound', 'default',
    'channelId', 'default',
    'data', jsonb_build_object('ravenId', p_raven_id)
  ))
  into all_messages
  from public.push_tokens pt
  where pt.user_id = any(p_audience);

  if all_messages is null then
    return; -- no one in the audience has a registered device
  end if;

  n := jsonb_array_length(all_messages);
  while i < n loop
    select jsonb_agg(elem)
    into chunk
    from jsonb_array_elements(all_messages) with ordinality as t(elem, ord)
    where ord > i and ord <= i + 100;

    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := chunk,
      timeout_milliseconds := 5000
    );

    i := i + 100;
  end loop;
end;
$$;

revoke execute on function public.send_expo_push(uuid[], text, text, uuid) from public, anon, authenticated;

-- notify_push's Edge Function dispatch is fully superseded by the two
-- functions above; nothing else calls it.
drop function if exists public.notify_push(text, jsonb);

-- ----------------------------------------------------------- event wiring

-- One compose inserts every recipient row in a single statement, so a
-- statement-level trigger gives one push call per raven, not one per friend.
create or replace function public.push_on_recipients_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  grp record;
  raven record;
  sender_name text;
begin
  for grp in
    select raven_id, array_agg(recipient_id) as recipients
    from inserted
    group by raven_id
  loop
    select id, sender_id, body into raven from public.ravens where id = grp.raven_id;
    if not found then continue; end if; -- recalled before the push fired

    select display_name into sender_name from public.profiles where id = raven.sender_id;

    perform public.send_expo_push(
      grp.recipients,
      coalesce(sender_name, 'A friend'),
      public.push_truncate(raven.body),
      raven.id
    );
  end loop;
  return null;
end;
$$;

create or replace function public.push_on_reply()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raven record;
  author_name text;
  audience uuid[];
  reply_body text;
begin
  select id, sender_id, body into raven from public.ravens where id = new.raven_id;
  if not found then return null; end if; -- recalled already

  -- Thread audience: sender + attending recipients, minus whoever wrote it.
  select array_agg(distinct uid) into audience
  from (
    select raven.sender_id as uid
    union
    select recipient_id from public.raven_recipients
    where raven_id = raven.id and status in ('in', 'late')
  ) as members
  where uid <> new.author_id;

  select display_name into author_name from public.profiles where id = new.author_id;

  reply_body := case
    when char_length(new.body) > 0 then public.push_truncate(new.body)
    else 'Sent a photo'
  end;

  perform public.send_expo_push(
    audience,
    coalesce(author_name, 'Someone') || ' · ' || public.push_truncate(raven.body, 40),
    reply_body,
    raven.id
  );
  return null;
end;
$$;

create or replace function public.push_on_rsvp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raven record;
  recipient_name text;
  title text;
begin
  select id, sender_id, body into raven from public.ravens where id = new.raven_id;
  if not found then return null; end if; -- recalled already

  select display_name into recipient_name from public.profiles where id = new.recipient_id;
  recipient_name := coalesce(recipient_name, 'Someone');

  title := case
    when new.status = 'in' then recipient_name || ' is in'
    else recipient_name || ' is running late'
  end;

  perform public.send_expo_push(
    array[raven.sender_id],
    title,
    public.push_truncate(raven.body),
    raven.id
  );
  return null;
end;
$$;

-- Trigger definitions (push_raven_sent, push_reply, push_rsvp) are
-- unchanged from 20260710000006_push.sql — only the function bodies above
-- changed, via CREATE OR REPLACE, so re-pointing them isn't needed here.
