-- The self-hosted Supabase image enables RLS on storage.buckets but ships no
-- default policies (hosted Supabase supplies this at the platform level, not
-- via user migrations). Without it, storage-api's per-request `SET ROLE`
-- causes every bucket lookup to see zero rows and report 404 "Bucket not
-- found", even though the row exists and the bucket is public.

create policy "buckets: public read"
  on storage.buckets for select
  using (public = true);
