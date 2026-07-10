-- Avatars are the user's own photo, not a themed emoji. The raven is the
-- messenger, not a bird theme.

alter table public.profiles add column avatar_url text;

-- Users may edit their name, photo, and the legacy emoji column.
revoke update on table public.profiles from authenticated;
grant update (display_name, avatar, avatar_url) on table public.profiles to authenticated;
