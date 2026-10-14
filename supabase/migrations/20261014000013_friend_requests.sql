-- Friends come from two places now — your invite link and your phone's
-- contacts — and either way it's a request the other person says yes to.
-- Every raven flies to all your friends, so nobody gets yours until you've
-- agreed: opening someone's link and tapping Add both ask, and two people
-- who ask each other are friends straight away.

-- ------------------------------------------------------------ requests

create table public.friend_requests (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Declining is silent: the request stays, the sender still sees it as
  -- asked, and it can't be sent again — a no can't be nagged into a yes.
  declined_at timestamptz,
  -- A sender taking back a request that was declined: it leaves their list,
  -- but the row stays so the no still holds (see withdraw_friend_request).
  withdrawn_at timestamptz,
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to_idx on public.friend_requests (to_id);

-- No direct access at all: who declined what stays server-side, and the
-- functions below are the only way in — my_friend_requests to read,
-- request_friend / answer_friend_request / withdraw_friend_request to change.
alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon, authenticated;

-- --------------------------------------------------------- being found

-- On by default, like most apps that match contacts; off means someone who
-- has your number won't find you unless you're already friends.
alter table public.profiles add column discoverable boolean not null default true;
grant update (discoverable) on public.profiles to authenticated;

-- ------------------------------------------------ seeing each other

-- A request, either way round, is enough to see each other's name and
-- photo — otherwise it couldn't say who it's from.
create or replace function public.can_see_profile(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select target = auth.uid()
    or are_friends(auth.uid(), target)
    or exists (
      select 1 from raven_recipients rr
      join ravens r on r.id = rr.raven_id
      where (r.sender_id = auth.uid() and rr.recipient_id = target)
         or (rr.recipient_id = auth.uid() and r.sender_id = target)
    )
    or exists (
      select 1 from raven_recipients mine
      join raven_recipients them
        on them.raven_id = mine.raven_id
      where mine.recipient_id = auth.uid()
        and them.recipient_id = target
        and them.status in ('in', 'late')
    )
    or exists (
      select 1 from friend_requests fr
      where (fr.from_id = auth.uid() and fr.to_id = target and fr.withdrawn_at is null)
         or (fr.to_id = auth.uid() and fr.from_id = target and fr.declined_at is null)
    );
$$;

-- --------------------------------------------------------- the rules

-- Pushes go through send_expo_push (20261009000008); these two cover the
-- moments someone needs to hear about a friendship.
create or replace function public.push_friend_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  asker text;
begin
  select display_name into asker from profiles where id = new.from_id;
  perform send_expo_push(
    array[new.to_id],
    coalesce(asker, 'Someone') || ' wants to be friends',
    'Say yes and your ravens reach each other.',
    null
  );
  return null;
end;
$$;

create trigger push_friend_request
  after insert on public.friend_requests
  for each row execute function public.push_friend_request();

-- Makes two people friends and tells the one who asked first.
create or replace function public.become_friends(asker uuid, answerer uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  answerer_name text;
begin
  insert into friendships (user_a, user_b)
  values (least(asker, answerer), greatest(asker, answerer))
  on conflict do nothing;
  delete from friend_requests
  where (from_id = asker and to_id = answerer) or (from_id = answerer and to_id = asker);
  select display_name into answerer_name from profiles where id = answerer;
  perform send_expo_push(
    array[asker],
    coalesce(answerer_name, 'Someone') || ' said yes',
    'You''re friends on Raven now — your ravens reach each other.',
    null
  );
end;
$$;
revoke execute on function public.become_friends(uuid, uuid) from public, anon, authenticated;

-- Asks `target` to be friends. If they've already asked you, that's a yes
-- from both sides and you're friends now. Returns 'requested' or 'friends'.
create or replace function public.request_friend(target uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if target = me then
    raise exception 'cannot add yourself';
  end if;
  if not exists (select 1 from profiles where id = me) then
    raise exception 'finish signing up first';
  end if;
  if not exists (select 1 from profiles where id = target) then
    raise exception 'that account isn''t on Raven anymore';
  end if;
  if are_friends(me, target) then
    return 'friends';
  end if;
  -- They asked you first — even if you'd said no then, asking back is a yes.
  if exists (select 1 from friend_requests where from_id = target and to_id = me) then
    perform become_friends(target, me);
    return 'friends';
  end if;
  -- Already asked — or asked and been declined, which must look the same
  -- from here: no new request, no new push, just back on your list.
  insert into friend_requests (from_id, to_id) values (me, target)
  on conflict (from_id, to_id) do update set withdrawn_at = null;
  return 'requested';
end;
$$;

-- Answers a request someone sent you.
create or replace function public.answer_friend_request(requester uuid, accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if not exists (
    select 1 from friend_requests
    where from_id = requester and to_id = me and declined_at is null
  ) then
    raise exception 'that request isn''t there anymore';
  end if;
  if accept then
    perform become_friends(requester, me);
  else
    update friend_requests set declined_at = now() where from_id = requester and to_id = me;
  end if;
end;
$$;

-- Taking back a request: gone for good if they hadn't answered; if they'd
-- already said no, it only leaves your list — deleting it would let you
-- ask again, and would tell you they'd declined.
create or replace function public.withdraw_friend_request(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from friend_requests
  where from_id = auth.uid() and to_id = target and declined_at is null;
  update friend_requests set withdrawn_at = now()
  where from_id = auth.uid() and to_id = target and declined_at is not null;
end;
$$;

-- Your requests both ways, with who they're from or to. Incoming leaves out
-- what you've declined; outgoing never says whether they have.
create or replace function public.my_friend_requests()
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  points integer,
  direction text, -- 'incoming' | 'outgoing'
  created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.points, 'incoming', fr.created_at
  from friend_requests fr join profiles p on p.id = fr.from_id
  where fr.to_id = auth.uid() and fr.declined_at is null
  union all
  select p.id, p.display_name, p.avatar_url, p.points, 'outgoing', fr.created_at
  from friend_requests fr join profiles p on p.id = fr.to_id
  where fr.from_id = auth.uid() and fr.withdrawn_at is null
  order by 6 desc;
$$;

-- Opening someone's invite link now asks them, same as Add — links get
-- forwarded, and a forwarded link shouldn't make a stranger your friend.
-- Returns 'requested' or 'friends' (was the inviter's id).
drop function public.redeem_invite(text);
create function public.redeem_invite(code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select p.id into target from profiles p where p.invite_code = code;
  if target is null then
    raise exception 'invalid invite code';
  end if;
  if target = auth.uid() then
    raise exception 'cannot add yourself';
  end if;
  return request_friend(target);
end;
$$;

-- ------------------------------------------------------------ contacts

-- Which of these numbers are on Raven? The phone sends its contacts'
-- numbers and gets back the ones that match. Nothing it sends is kept —
-- contact_lookups records only when someone looked, so the lookups can be
-- rationed: enough for anyone's address book, not enough to sweep the
-- phone book for who's here.
create table public.contact_lookups (
  user_id uuid not null references public.profiles (id) on delete cascade,
  looked_up_at timestamptz not null default now()
);
create index contact_lookups_user_idx on public.contact_lookups (user_id, looked_up_at);
alter table public.contact_lookups enable row level security; -- no policies: match_contacts only

create or replace function public.match_contacts(phones text[])
returns table (
  phone text,
  id uuid,
  display_name text,
  avatar_url text,
  points integer,
  status text -- 'friends' | 'requested' | 'asked_you' | 'none'
)
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if coalesce(array_length(phones, 1), 0) > 2000 then
    raise exception 'too many numbers at once';
  end if;
  delete from contact_lookups where user_id = me and looked_up_at < now() - interval '1 hour';
  if (select count(*) from contact_lookups where user_id = me) >= 30 then
    raise exception 'You''re going a bit fast — try again in a while.';
  end if;
  insert into contact_lookups (user_id) values (me);

  return query
  select
    '+' || u.phone,
    p.id,
    p.display_name,
    p.avatar_url,
    p.points,
    case
      when are_friends(me, p.id) then 'friends'
      -- A declined request still reads as asked: declines stay silent.
      when exists (
        select 1 from friend_requests fr
        where fr.from_id = me and fr.to_id = p.id and fr.withdrawn_at is null
      ) then 'requested'
      when exists (
        select 1 from friend_requests fr
        where fr.from_id = p.id and fr.to_id = me and fr.declined_at is null
      ) then 'asked_you'
      else 'none'
    end
  from auth.users u
  join profiles p on p.id = u.id
  where u.phone = any (select ltrim(x, '+') from unnest(phones) as x)
    and u.phone_confirmed_at is not null
    and p.id <> me
    and (p.discoverable or are_friends(me, p.id));
end;
$$;

revoke execute on function public.match_contacts(text[]) from public, anon;
revoke execute on function public.my_friend_requests() from public, anon;
revoke execute on function public.withdraw_friend_request(uuid) from public, anon;
grant execute on function public.my_friend_requests() to authenticated;
grant execute on function public.withdraw_friend_request(uuid) to authenticated;
revoke execute on function public.request_friend(uuid) from public, anon;
revoke execute on function public.answer_friend_request(uuid, boolean) from public, anon;
grant execute on function public.match_contacts(text[]) to authenticated;
grant execute on function public.request_friend(uuid) to authenticated;
grant execute on function public.answer_friend_request(uuid, boolean) to authenticated;
