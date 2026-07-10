-- Raven V1 schema.
-- Social model encoded here, not in app code:
--   * recipients see who is IN (and running late), never the invite list or declines
--   * reply threads are visible to the sender + attending recipients only
--   * every raven expires; expired ravens accept no RSVPs or replies

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  invite_code text not null unique default encode(gen_random_bytes(5), 'hex'),
  created_at timestamptz not null default now()
);

-- One row per friendship, ordered pair so (a,b) and (b,a) can't both exist.
create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- Circles are private sender-side shortcuts: recipients never see them.
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  primary key (circle_id, friend_id)
);

create type public.rsvp_status as enum ('pending', 'in', 'late', 'cant');

create table public.ravens (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.raven_recipients (
  raven_id uuid not null references public.ravens (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null default 'pending',
  responded_at timestamptz,
  primary key (raven_id, recipient_id)
);

create table public.raven_replies (
  id uuid primary key default gen_random_uuid(),
  raven_id uuid not null references public.ravens (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index raven_recipients_recipient_idx on public.raven_recipients (recipient_id);
create index ravens_sender_idx on public.ravens (sender_id);
create index ravens_expires_idx on public.ravens (expires_at);
create index raven_replies_raven_idx on public.raven_replies (raven_id);
create index circles_owner_idx on public.circles (owner_id);
create index friendships_user_b_idx on public.friendships (user_b);

-- ------------------------------------------------- helper functions
-- security definer so RLS policies can consult tables (incl. the table the
-- policy guards) without infinite recursion.

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from friendships
    where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

create or replace function public.is_raven_sender(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from ravens where id = rid and sender_id = auth.uid());
$$;

create or replace function public.is_raven_recipient(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from raven_recipients
    where raven_id = rid and recipient_id = auth.uid()
  );
$$;

-- "Attending" = in or running late. Late people are coming; they get the thread.
create or replace function public.is_raven_attending(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from raven_recipients
    where raven_id = rid and recipient_id = auth.uid() and status in ('in', 'late')
  );
$$;

create or replace function public.raven_active(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from ravens where id = rid and expires_at > now());
$$;

-- Whose profile may I see? Self, friends, people I share a raven with
-- (sender<->recipient either direction), and attending co-recipients.
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
    );
$$;

-- ------------------------------------------------------------- RPCs

-- Look up who an invite link belongs to, without exposing the profiles table.
create or replace function public.get_invite_profile(code text)
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name from profiles p where p.invite_code = code;
$$;

-- Redeem an invite link: creates the friendship both ways in one row.
create or replace function public.redeem_invite(code text)
returns uuid
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
  insert into friendships (user_a, user_b)
  values (least(auth.uid(), target), greatest(auth.uid(), target))
  on conflict do nothing;
  return target;
end;
$$;

-- --------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.ravens enable row level security;
alter table public.raven_recipients enable row level security;
alter table public.raven_replies enable row level security;

-- profiles
create policy "profiles: see self, friends, raven co-participants"
  on public.profiles for select
  using (public.can_see_profile(id));
create policy "profiles: create own"
  on public.profiles for insert
  with check (id = auth.uid());
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- friendships (created only via redeem_invite; either side may end one)
create policy "friendships: see own"
  on public.friendships for select
  using (user_a = auth.uid() or user_b = auth.uid());
create policy "friendships: either side may remove"
  on public.friendships for delete
  using (user_a = auth.uid() or user_b = auth.uid());

-- circles: entirely private to their owner
create policy "circles: owner all"
  on public.circles for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy "circle_members: owner all"
  on public.circle_members for all
  using (exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
    and public.are_friends(auth.uid(), friend_id)
  );

-- ravens
create policy "ravens: sender and recipients see"
  on public.ravens for select
  using (sender_id = auth.uid() or public.is_raven_recipient(id));
create policy "ravens: send own"
  on public.ravens for insert
  with check (sender_id = auth.uid() and expires_at > now());
create policy "ravens: sender may recall"
  on public.ravens for delete
  using (sender_id = auth.uid());

-- raven_recipients — the heart of the social model:
--   sender sees every row; a recipient sees their own row and attending rows only.
create policy "recipients: sender sees all, others see self + attending"
  on public.raven_recipients for select
  using (
    public.is_raven_sender(raven_id)
    or recipient_id = auth.uid()
    or (status in ('in', 'late') and public.is_raven_recipient(raven_id))
  );
create policy "recipients: sender addresses friends only"
  on public.raven_recipients for insert
  with check (
    public.is_raven_sender(raven_id)
    and public.are_friends(auth.uid(), recipient_id)
  );
create policy "recipients: rsvp to own row while active"
  on public.raven_recipients for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid() and public.raven_active(raven_id));

-- raven_replies: a tiny thread for the sender + attending recipients
create policy "replies: sender and attending see"
  on public.raven_replies for select
  using (public.is_raven_sender(raven_id) or public.is_raven_attending(raven_id));
create policy "replies: sender and attending write while active"
  on public.raven_replies for insert
  with check (
    author_id = auth.uid()
    and (public.is_raven_sender(raven_id) or public.is_raven_attending(raven_id))
    and public.raven_active(raven_id)
  );

-- ------------------------------------------------------------ grants
-- RLS is the guard; roles still need base table privileges.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------- realtime

alter publication supabase_realtime add table public.ravens;
alter publication supabase_realtime add table public.raven_recipients;
alter publication supabase_realtime add table public.raven_replies;
