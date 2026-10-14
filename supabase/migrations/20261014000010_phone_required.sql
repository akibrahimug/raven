-- Signing up is email first (Google or a magic link), then a phone number
-- proven by SMS code; logging back in is that number alone. The apps walk
-- people through that order. These rules hold the same line for anyone
-- calling the API directly.
--
-- Needs phone auto-confirm OFF in GoTrue (ENABLE_PHONE_AUTOCONFIRM=false /
-- [auth.sms] enable_confirmations = true): with it on, attaching a number
-- to an account confirms it on the spot, no code involved.

-- A profile is what makes an account usable — friendships, ravens and
-- replies all hang off it — so it's the one gate: no profile without a
-- verified number. The live server's test logins (Ofcom's fictional
-- 07700 900xxx range) verify with a code that never changes, so they don't
-- count: the test accounts that already exist keep working, but none can
-- be started. The apps refuse those numbers up front too (isTestNumber in
-- packages/shared/src/auth.ts).
create or replace function public.has_verified_phone()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and phone_confirmed_at is not null
      and coalesce(phone, '') <> ''
      and phone not like '447700900%'
  );
$$;

drop policy "profiles: create own" on public.profiles;
create policy "profiles: create own"
  on public.profiles for insert
  with check (id = auth.uid() and public.has_verified_phone());

-- Nobody signs up with just a number. The apps never ask the server to
-- (logging in passes shouldCreateUser: false), but POST /auth/v1/otp with
-- create_user would still make a phone-only login — and that row would hold
-- the number against its real owner, whose sign-up could no longer claim it.
-- Raising here fails the insert before GoTrue sends any SMS.
create or replace function public.reject_phone_only_signup()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if coalesce(new.phone, '') <> '' and coalesce(new.email, '') = '' then
    raise exception 'sign up with an email first, then add a phone number';
  end if;
  return new;
end;
$$;

create trigger reject_phone_only_signup
  before insert on auth.users
  for each row execute function public.reject_phone_only_signup();

-- GoTrue matches a phone-change code to the first account it finds with
-- that number pending, not to the account sending the code. Two pending
-- changes to one number — a sign-up abandoned at the phone step, then a
-- fresh one with another email — would leave the newer account unable to
-- ever verify. So the latest request wins: asking for a code on a number
-- cancels every other account's pending change to it. Not security definer:
-- it runs as GoTrue's own role, which owns auth.users.
create or replace function public.release_pending_phone()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  update auth.users
  set phone_change = '', phone_change_token = '', phone_change_sent_at = null
  where phone_change = new.phone_change and id <> new.id;
  return null;
end;
$$;

create trigger release_pending_phone
  after update of phone_change on auth.users
  for each row when (new.phone_change <> '')
  execute function public.release_pending_phone();
