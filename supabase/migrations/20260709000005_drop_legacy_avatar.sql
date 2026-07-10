-- The emoji avatar column is fully superseded by avatar_url (a real photo).
-- Nothing reads it anymore; its bird-emoji default was the last trace of the
-- bird theme the product moved away from.

alter table public.profiles drop column avatar;
