-- Deleting your account removes all of it. The auth.users row cascades to
-- the profile (and GoTrue's own identities, sessions and tokens), and the
-- profile cascades to everything else: friendships, circles, push tokens,
-- the ravens you sent with their recipients and replies, your RSVPs on other
-- people's ravens, and the replies you wrote there. Nothing has a delete
-- trigger, so no pushes or point changes fire on the way out.
--
-- Photos live in Storage, outside these cascades, and only the Storage API
-- removes the files themselves — deleting storage.objects rows here would
-- strand them in the bucket. So the apps clear the user's folder first,
-- while their session can still do it, then call this.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
