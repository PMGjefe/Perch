-- Row-level security, views and functions.

-- ---------------------------------------------------------------- helpers
create or replace function public.is_following(follower uuid, followee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.follows where follower_id = follower and followee_id = followee);
$$;

create or replace function public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- Deterministic fuzz: every sighting near a user's home collapses to one point inside the
-- 0.02 degree (~2 km) cell containing the home, shifted by a per-user pseudo-random jitter,
-- so averaging many pins never converges on the real home.
create or replace function public.fuzz_coord(v double precision, salt text) returns double precision
language sql immutable as $$
  select floor(v / 0.02) * 0.02 + 0.01 + ((abs(hashtext(salt)) % 1000) / 1000.0 - 0.5) * 0.01;
$$;

-- ---------------------------------------------------------------- views
create view public.public_profiles as
  select id, username, display_name, avatar_url, bio, created_at from public.profiles;

create view public.public_sightings as
  with s as (
    select s.*,
      s.user_id = auth.uid() as is_owner,
      (p.hide_home and p.home_lat is not null and s.lat is not null
        and public.haversine_m(s.lat, s.lng, p.home_lat, p.home_lng) <= 500) as near_home,
      p.home_lat, p.home_lng
    from public.sightings s
    join public.profiles p on p.id = s.user_id
    where s.user_id = auth.uid()
       or s.visibility = 'public'
       or (s.visibility = 'followers' and public.is_following(auth.uid(), s.user_id))
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

create view public.life_list as
  select
    user_id,
    species_code,
    min(observed_at) as first_seen,
    count(*)::int as sighting_count,
    (array_agg(photo_path order by observed_at) filter (where photo_path is not null))[1] as photo_path,
    (array_agg(id order by observed_at))[1] as first_sighting_id
  from public.public_sightings
  group by user_id, species_code;

-- Views run as their owner; grant only to signed-in users.
revoke all on public.public_profiles, public.public_sightings, public.life_list from anon, public;
grant select on public.public_profiles, public.public_sightings, public.life_list to authenticated;

-- ---------------------------------------------------------------- functions
-- Chronological feed: sightings and public lists from people the caller follows, plus their own.
create or replace function public.feed(before timestamptz default now(), page_size int default 30)
returns table (kind text, created_at timestamptz, payload jsonb)
language sql stable security invoker set search_path = public as $$
  with people as (
    select followee_id as id from public.follows where follower_id = auth.uid()
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

create or replace function public.engagement(t public.target_type, ids uuid[])
returns table (target_id uuid, like_count int, comment_count int, liked_by_me boolean)
language sql stable security invoker set search_path = public as $$
  select x.id,
    (select count(*)::int from public.likes l where l.target_type = t and l.target_id = x.id),
    (select count(*)::int from public.comments c where c.target_type = t and c.target_id = x.id),
    exists (select 1 from public.likes l where l.target_type = t and l.target_id = x.id and l.user_id = auth.uid())
  from unnest(ids) as x(id);
$$;

create or replace function public.profile_stats(uid uuid)
returns table (followers int, following int, species_count int, sighting_count int, list_count int, is_followed_by_me boolean)
language sql stable security invoker set search_path = public as $$
  select
    (select count(*)::int from public.follows where followee_id = uid),
    (select count(*)::int from public.follows where follower_id = uid),
    (select count(distinct species_code)::int from public.public_sightings where user_id = uid),
    (select count(*)::int from public.public_sightings where user_id = uid),
    (select count(*)::int from public.lists where user_id = uid and (is_public or user_id = auth.uid())),
    exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = uid);
$$;

create or replace function public.search_profiles(q text, page_size int default 20)
returns setof public.public_profiles
language sql stable security invoker set search_path = public as $$
  select * from public.public_profiles
  where username ilike '%' || q || '%' or display_name ilike '%' || q || '%'
  order by username
  limit page_size;
$$;

-- Is a list visible to the caller?
create or replace function public.can_view_list(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists where id = lid and (is_public or user_id = auth.uid()));
$$;
create or replace function public.can_view_sighting(sid uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.public_sightings where id = sid);
$$;

revoke all on function public.feed, public.engagement, public.profile_stats, public.search_profiles from anon, public;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.species enable row level security;
alter table public.sightings enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.follows enable row level security;
alter table public.list_follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

-- profiles: only the owner touches the base table (others use public_profiles)
create policy "profiles: owner read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: owner update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- species: read-only for everyone signed in
create policy "species: read" on public.species for select to authenticated using (true);

-- sightings: owner only on the base table (others use public_sightings)
create policy "sightings: owner all" on public.sightings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- lists
create policy "lists: read public or own" on public.lists for select to authenticated
  using (is_public or user_id = auth.uid());
create policy "lists: owner insert" on public.lists for insert to authenticated with check (user_id = auth.uid());
create policy "lists: owner update" on public.lists for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lists: owner delete" on public.lists for delete to authenticated using (user_id = auth.uid());

create policy "list_items: read visible" on public.list_items for select to authenticated
  using (public.can_view_list(list_id));
create policy "list_items: owner write" on public.list_items for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

-- follows: anyone signed in can see the graph; you only write your own edges
create policy "follows: read" on public.follows for select to authenticated using (true);
create policy "follows: own insert" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "follows: own delete" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "list_follows: read" on public.list_follows for select to authenticated using (true);
create policy "list_follows: own insert" on public.list_follows for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_list(list_id));
create policy "list_follows: own delete" on public.list_follows for delete to authenticated using (user_id = auth.uid());

-- likes
create policy "likes: read" on public.likes for select to authenticated using (true);
create policy "likes: own insert" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and (
    (target_type = 'sighting' and public.can_view_sighting(target_id)) or
    (target_type = 'list' and public.can_view_list(target_id))));
create policy "likes: own delete" on public.likes for delete to authenticated using (user_id = auth.uid());

-- comments: visible when the target is visible
create policy "comments: read visible" on public.comments for select to authenticated
  using ((target_type = 'sighting' and public.can_view_sighting(target_id)) or
         (target_type = 'list' and public.can_view_list(target_id)));
create policy "comments: own insert" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and (
    (target_type = 'sighting' and public.can_view_sighting(target_id)) or
    (target_type = 'list' and public.can_view_list(target_id))));
create policy "comments: own delete" on public.comments for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sighting-photos', 'sighting-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "photos: public read" on storage.objects for select using (bucket_id = 'sighting-photos');
create policy "photos: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'sighting-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'sighting-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sighting-photos' and (storage.foldername(name))[1] = auth.uid()::text);
