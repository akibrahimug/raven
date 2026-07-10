-- Push notifications: device tokens + event fan-out to the send-push Edge Function.
-- The function URL and shared secret live in Vault (push_fn_url / push_fn_secret),
-- created out-of-band so no secret is committed here. Where they're absent
-- (fresh local dev), the triggers no-op silently and the app behaves as before.

create extension if not exists pg_net;

-- ---------------------------------------------------------------- tokens

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens: see own"
  on public.push_tokens for select
  using (user_id = auth.uid());
create policy "push_tokens: remove own"
  on public.push_tokens for delete
  using (user_id = auth.uid());

grant select, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

-- A device changing hands (sign out missed, new account signs in) must steal
-- the token row from the previous owner, which owner-scoped RLS can't allow;
-- security definer performs the swap atomically instead of an insert policy.
create or replace function public.register_push_token(t text, p text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p not in ('ios', 'android') then
    raise exception 'unknown platform';
  end if;
  delete from push_tokens where token = t;
  insert into push_tokens (token, user_id, platform) values (t, auth.uid(), p);
end;
$$;

-- --------------------------------------------------------------- fan-out

create or replace function public.notify_push(event text, payload jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  fn_url text;
  fn_secret text;
begin
  select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'push_fn_url';
  select decrypted_secret into fn_secret
    from vault.decrypted_secrets where name = 'push_fn_secret';
  if fn_url is null or fn_secret is null then
    return; -- push not configured in this environment
  end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', fn_secret
    ),
    body := jsonb_build_object('event', event) || payload,
    timeout_milliseconds := 5000
  );
end;
$$;

-- Callable only from triggers; direct execution would let any signed-in user
-- spam the push endpoint.
revoke execute on function public.notify_push(text, jsonb) from public, anon, authenticated;

-- One compose inserts every recipient row in a single statement, so a
-- statement-level trigger gives one push call per raven, not one per friend.
create or replace function public.push_on_recipients_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  grp record;
begin
  for grp in
    select raven_id, jsonb_agg(recipient_id) as recipients
    from inserted
    group by raven_id
  loop
    perform public.notify_push(
      'raven_sent',
      jsonb_build_object('raven_id', grp.raven_id, 'recipient_ids', grp.recipients)
    );
  end loop;
  return null;
end;
$$;

create trigger push_raven_sent
  after insert on public.raven_recipients
  referencing new table as inserted
  for each statement
  execute function public.push_on_recipients_insert();

create or replace function public.push_on_reply()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.notify_push(
    'reply',
    jsonb_build_object(
      'raven_id', new.raven_id,
      'reply_id', new.id,
      'author_id', new.author_id,
      'body', new.body,
      'has_media', new.media_url is not null
    )
  );
  return null;
end;
$$;

create trigger push_reply
  after insert on public.raven_replies
  for each row
  execute function public.push_on_reply();

-- Only in/late reach the sender; declining stays silent by design.
create or replace function public.push_on_rsvp()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.notify_push(
    'rsvp',
    jsonb_build_object(
      'raven_id', new.raven_id,
      'recipient_id', new.recipient_id,
      'status', new.status
    )
  );
  return null;
end;
$$;

create trigger push_rsvp
  after update of status on public.raven_recipients
  for each row
  when (new.status in ('in', 'late') and new.status is distinct from old.status)
  execute function public.push_on_rsvp();
