-- Hardening pass: photo path restriction, avatar URL constraint, non-identifying default
-- usernames, anon function exposure, and an index for the storage photo policy.

-- photo_path: owner's folder, or (dev seed only) an Unsplash image URL.
create or replace function public.check_sighting_photo_path() returns trigger
language plpgsql as $$
begin
  if new.photo_path is not null
     and position(new.user_id::text || '/' in new.photo_path) <> 1
     and new.photo_path !~ '^https://images\.unsplash\.com/' then
    raise exception 'photo_path must be a storage path under the owner id';
  end if;
  return new;
end $$;

-- avatar_url must point at this project's public avatars bucket, under the owner's folder.
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url is null or position('/storage/v1/object/public/avatars/' || id::text || '/' in avatar_url) > 0);

-- Default usernames must not leak the email local part (OAuth sign-ups have no username step).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-z0-9_]', '', 'gi'));
  if char_length(base) < 3 then
    base := 'birder_' || substr(md5(new.id::text || clock_timestamp()::text), 1, 6);
  end if;
  base := left(base, 24);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 22) || n::text;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

-- Functions are for signed-in users only (is_following is SECURITY DEFINER and would expose the follow graph).
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- The storage SELECT policy looks sightings up by photo_path.
create index if not exists sightings_photo_path_idx on public.sightings (photo_path) where photo_path is not null;
