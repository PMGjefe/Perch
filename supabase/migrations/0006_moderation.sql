-- Moderation and account lifecycle: blocks, reports, account deletion.

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "blocks: own read" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "blocks: own insert" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "blocks: own delete" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

create type public.report_target as enum ('sighting', 'list', 'comment', 'profile');
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
-- Reports are write-only for users; moderators read them with the service role.
create policy "reports: own insert" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

/** True when either side has blocked the other. */
create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Blocked users disappear from each other's view.
create or replace view public.public_sightings as
  with s as (
    select s.*,
      s.user_id = auth.uid() as is_owner,
      (p.hide_home and p.home_lat is not null and s.lat is not null
        and public.haversine_m(s.lat, s.lng, p.home_lat, p.home_lng) <= 500) as near_home,
      p.home_lat, p.home_lng
    from public.sightings s
    join public.profiles p on p.id = s.user_id
    where (s.user_id = auth.uid()
       or s.visibility = 'public'
       or (s.visibility = 'followers' and public.is_following(auth.uid(), s.user_id)))
      and not public.is_blocked(auth.uid(), s.user_id)
  )
  select
    id, user_id, species_code, observed_at,
    case when is_owner then lat when sensitive then null when near_home then public.fuzz_coord(home_lat, user_id::text || 'lat') else lat end as lat,
    case when is_owner then lng when sensitive then null when near_home then public.fuzz_coord(home_lng, user_id::text || 'lng') else lng end as lng,
    case when is_owner then place_name when sensitive or near_home then null else place_name end as place_name,
    photo_path, note, visibility, sensitive, source, created_at, updated_at,
    (not is_owner and not sensitive and near_home) as location_fuzzed,
    (not is_owner and sensitive) as location_hidden
  from s;
revoke all on public.public_sightings from anon, public;
grant select on public.public_sightings to authenticated;

create or replace function public.search_profiles(q text, page_size int default 20)
returns setof public.public_profiles
language sql stable security invoker set search_path = public as $$
  select * from public.public_profiles p
  where (username ilike '%' || q || '%' or display_name ilike '%' || q || '%')
    and not public.is_blocked(auth.uid(), p.id)
  order by username
  limit page_size;
$$;

create or replace function public.feed(before timestamptz default now(), page_size int default 30)
returns table (kind text, created_at timestamptz, payload jsonb)
language sql stable security invoker set search_path = public as $$
  with people as (
    select followee_id as id from public.follows where follower_id = auth.uid() and not public.is_blocked(auth.uid(), followee_id)
    union select auth.uid()
  )
  select 'sighting', ps.created_at, to_jsonb(ps)
    from public.public_sightings ps
    where ps.user_id in (select id from people) and ps.created_at < before
  union all
  select 'list', l.created_at, to_jsonb(l)
    from public.lists l
    where l.user_id in (select id from people) and (l.is_public or l.user_id = auth.uid()) and l.created_at < before
  order by 2 desc
  limit page_size;
$$;

-- Comments from blocked users are hidden too.
drop policy if exists "comments: read visible" on public.comments;
create policy "comments: read visible" on public.comments for select to authenticated
  using (not public.is_blocked(auth.uid(), user_id) and (
         (target_type = 'sighting' and public.can_view_sighting(target_id)) or
         (target_type = 'list' and public.can_view_list(target_id))));

/** Delete the calling user's account and everything they own. Storage objects are removed first. */
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from storage.objects where bucket_id in ('sighting-photos', 'avatars') and (storage.foldername(name))[1] = uid::text;
  delete from auth.users where id = uid; -- cascades to profiles and everything referencing it
end $$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
