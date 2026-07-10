-- Avatars + the reward system: accepting ravens earns points, points set your
-- level, and your level changes how you appear to friends.

alter table public.profiles add column avatar text not null default '🐦'
  check (char_length(avatar) between 1 and 8);
alter table public.profiles add column points integer not null default 0
  check (points >= 0);

-- Points are earned, never self-assigned: users may only update name + avatar.
revoke update on table public.profiles from authenticated;
grant update (display_name, avatar) on table public.profiles to authenticated;

-- +10 for accepting a raven (in or late = attending), taken back if you bail.
-- One recipient row per raven means points can't be farmed by toggling.
create or replace function public.apply_rsvp_points()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  delta integer := 0;
begin
  if (old.status in ('in', 'late')) and (new.status not in ('in', 'late')) then
    delta := -10;
  elsif (old.status not in ('in', 'late')) and (new.status in ('in', 'late')) then
    delta := 10;
  end if;
  if delta <> 0 then
    update profiles set points = greatest(0, points + delta) where id = new.recipient_id;
  end if;
  return new;
end;
$$;

create trigger raven_rsvp_points
  after update of status on public.raven_recipients
  for each row execute function public.apply_rsvp_points();
