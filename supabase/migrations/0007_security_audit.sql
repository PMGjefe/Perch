-- Security audit follow-ups.

-- ---------------------------------------------------------------- follow approval
-- "Followers" visibility is only meaningful if the owner can gate who follows them.
alter table public.profiles add column approve_followers boolean not null default false;
alter table public.follows add column status text not null default 'accepted' check (status in ('pending', 'accepted'));

create or replace function public.follows_default_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.status := case when (select approve_followers from public.profiles where id = new.followee_id) then 'pending' else 'accepted' end;
  return new;
end $$;
create trigger follows_default_status before insert on public.follows for each row execute function public.follows_default_status();

create or replace function public.is_following(follower uuid, followee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (follower = auth.uid() or followee = auth.uid())
     and exists (select 1 from public.follows where follower_id = follower and followee_id = followee and status = 'accepted');
$$;

-- The followee may accept a request or remove a follower.
create policy "follows: followee accept" on public.follows for update to authenticated
  using (followee_id = auth.uid()) with check (followee_id = auth.uid() and follower_id = follower_id);
create policy "follows: followee delete" on public.follows for delete to authenticated using (followee_id = auth.uid());

-- Counts and the graph only show accepted edges to third parties; the two parties see pending rows.
drop policy if exists "follows: read" on public.follows;
create policy "follows: read" on public.follows for select to authenticated
  using (status = 'accepted' or follower_id = auth.uid() or followee_id = auth.uid());

drop function if exists public.profile_stats(uuid);
create function public.profile_stats(uid uuid)
returns table (followers int, following int, species_count int, sighting_count int, list_count int, is_followed_by_me boolean, follow_requested boolean)
language sql stable security invoker set search_path = public as $$
  select
    (select count(*)::int from public.follows where followee_id = uid and status = 'accepted'),
    (select count(*)::int from public.follows where follower_id = uid and status = 'accepted'),
    (select count(distinct species_code)::int from public.public_sightings where user_id = uid),
    (select count(*)::int from public.public_sightings where user_id = uid),
    (select count(*)::int from public.lists where user_id = uid and (is_public or user_id = auth.uid())),
    exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = uid and status = 'accepted'),
    exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = uid and status = 'pending');
$$;

-- Blocking removes any follow edges between the two people.
create or replace function public.blocks_remove_follows() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows where (follower_id = new.blocker_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.list_follows lf using public.lists l where lf.list_id = l.id and ((lf.user_id = new.blocked_id and l.user_id = new.blocker_id) or (lf.user_id = new.blocker_id and l.user_id = new.blocked_id));
  return new;
end $$;
create trigger blocks_remove_follows after insert on public.blocks for each row execute function public.blocks_remove_follows();

-- is_blocked only answers about the caller.
create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (a = auth.uid() or b = auth.uid())
     and exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- ---------------------------------------------------------------- likes follow visibility; engagement is bounded and visibility-checked
drop policy if exists "likes: read" on public.likes;
create policy "likes: read visible" on public.likes for select to authenticated
  using ((target_type = 'sighting' and public.can_view_sighting(target_id)) or (target_type = 'list' and public.can_view_list(target_id)));

create or replace function public.engagement(t public.target_type, ids uuid[])
returns table (target_id uuid, like_count int, comment_count int, liked_by_me boolean)
language sql stable security invoker set search_path = public as $$
  select x.id,
    (select count(*)::int from public.likes l where l.target_type = t and l.target_id = x.id),
    (select count(*)::int from public.comments c where c.target_type = t and c.target_id = x.id),
    exists (select 1 from public.likes l where l.target_type = t and l.target_id = x.id and l.user_id = auth.uid())
  from unnest(ids[1:100]) as x(id)
  where (t = 'sighting' and public.can_view_sighting(x.id)) or (t = 'list' and public.can_view_list(x.id));
$$;

-- Content owners can remove comments on their own sightings and lists.
create policy "comments: target owner delete" on public.comments for delete to authenticated
  using ((target_type = 'sighting' and exists (select 1 from public.sightings s where s.id = target_id and s.user_id = auth.uid()))
      or (target_type = 'list' and exists (select 1 from public.lists l where l.id = target_id and l.user_id = auth.uid())));

-- Lists may only hold sightings the owner can see.
drop policy if exists "list_items: owner write" on public.list_items;
create policy "list_items: owner write" on public.list_items for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
              and (sighting_id is null or public.can_view_sighting(sighting_id)));

-- ---------------------------------------------------------------- input bounds
alter table public.profiles
  add constraint profiles_display_name_len check (char_length(display_name) <= 60),
  add constraint profiles_avatar_url_len check (avatar_url is null or char_length(avatar_url) <= 512);
alter table public.sightings
  add constraint sightings_place_name_len check (place_name is null or char_length(place_name) <= 120),
  add constraint sightings_source_ref_len check (source_ref is null or char_length(source_ref) <= 64),
  add constraint sightings_photo_path_len check (photo_path is null or char_length(photo_path) <= 256),
  add constraint sightings_not_future check (observed_at <= now() + interval '1 day');
alter table public.reports add constraint reports_unique unique (reporter_id, target_type, target_id);

-- avatar_url must be a storage URL for the owner's folder (anchored, no query string).
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url is null or avatar_url ~ ('^https://[a-z0-9.-]+/storage/v1/object/public/avatars/' || id::text || '/[A-Za-z0-9._-]+$'));

-- created_at is server-stamped and immutable (it orders the feed).
create or replace function public.stamp_created_at() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.created_at := now();
  else new.created_at := old.created_at; end if;
  return new;
end $$;
create trigger sightings_created_at before insert or update on public.sightings for each row execute function public.stamp_created_at();
create trigger lists_created_at before insert or update on public.lists for each row execute function public.stamp_created_at();
create trigger comments_created_at before insert or update on public.comments for each row execute function public.stamp_created_at();

-- ---------------------------------------------------------------- rate limits
create or replace function public.rate_limit(tbl text, per_minute int) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - interval ''1 minute''',
    tbl, case tbl when 'follows' then 'follower_id' when 'reports' then 'reporter_id' when 'blocks' then 'blocker_id' else 'user_id' end)
    into n using auth.uid();
  if n >= per_minute then raise exception 'Slow down: too many % in the last minute', tbl using errcode = 'P0001'; end if;
end $$;
create or replace function public.rl_comments() returns trigger language plpgsql as $$ begin perform public.rate_limit('comments', 10); return new; end $$;
create or replace function public.rl_likes() returns trigger language plpgsql as $$ begin perform public.rate_limit('likes', 60); return new; end $$;
create or replace function public.rl_follows() returns trigger language plpgsql as $$ begin perform public.rate_limit('follows', 30); return new; end $$;
create or replace function public.rl_reports() returns trigger language plpgsql as $$ begin perform public.rate_limit('reports', 5); return new; end $$;
create or replace function public.rl_sightings() returns trigger language plpgsql as $$ begin perform public.rate_limit('sightings', 600); return new; end $$;
create trigger rl_comments before insert on public.comments for each row execute function public.rl_comments();
create trigger rl_likes before insert on public.likes for each row execute function public.rl_likes();
create trigger rl_follows before insert on public.follows for each row execute function public.rl_follows();
create trigger rl_reports before insert on public.reports for each row execute function public.rl_reports();
create trigger rl_sightings before insert on public.sightings for each row execute function public.rl_sightings();

-- ---------------------------------------------------------------- search: escaped, bounded, indexed
create extension if not exists pg_trgm;
create index if not exists profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_display_name_trgm on public.profiles using gin (display_name gin_trgm_ops);
create or replace function public.search_profiles(q text, page_size int default 20)
returns setof public.public_profiles
language sql stable security invoker set search_path = public as $$
  with needle as (select '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat)
  select p.* from public.public_profiles p, needle
  where char_length(q) >= 2
    and (p.username ilike needle.pat or p.display_name ilike needle.pat)
    and not public.is_blocked(auth.uid(), p.id)
  order by p.username
  limit least(greatest(page_size, 1), 50);
$$;

-- feed page size bounded
create or replace function public.feed(before timestamptz default now(), page_size int default 30)
returns table (kind text, created_at timestamptz, payload jsonb)
language sql stable security invoker set search_path = public as $$
  with people as (
    select followee_id as id from public.follows where follower_id = auth.uid() and status = 'accepted' and not public.is_blocked(auth.uid(), followee_id)
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
  limit least(greatest(page_size, 1), 100);
$$;

-- ---------------------------------------------------------------- storage: avatars readable but not listable by anon; old avatars replaced
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');

-- ---------------------------------------------------------------- views and privileges
alter view public.public_sightings set (security_barrier = true);
alter view public.life_list set (security_barrier = true);
alter default privileges in schema public revoke execute on functions from anon, public;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
