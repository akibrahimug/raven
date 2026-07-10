-- Photos on ravens and replies, backed by a public storage bucket.
-- Media URLs are unguessable (uuid paths); write access is owner-scoped.

alter table public.ravens add column media_url text;
alter table public.raven_replies add column media_url text;

-- A reply may be photo-only, but never completely empty.
alter table public.raven_replies drop constraint raven_replies_body_check;
alter table public.raven_replies add constraint raven_replies_body_check
  check (char_length(body) <= 500 and (char_length(body) > 0 or media_url is not null));

insert into storage.buckets (id, name, public)
values ('raven-media', 'raven-media', true)
on conflict (id) do nothing;

create policy "media: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'raven-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "media: public read"
  on storage.objects for select
  using (bucket_id = 'raven-media');

create policy "media: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'raven-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
