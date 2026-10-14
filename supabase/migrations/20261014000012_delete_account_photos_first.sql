-- delete_my_account() now refuses while the caller still has photos.
--
-- Photos sit in Storage, outside the database's cascades, and only the
-- Storage API removes the files themselves. If the account went first, its
-- photos would be left in the bucket with no owner and no way for the app
-- to reach them — so every client (and any direct API call) has to clear
-- the user's folder before this will run. The apps delete one file per
-- request: the live server's Oracle Object Storage rejects the bulk delete
-- supabase-js sends ("Missing required header: Content-MD5…").
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'raven-media'
      and (storage.foldername(name))[1] = auth.uid()::text
  ) then
    raise exception 'Your photos are still being deleted — try again.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
