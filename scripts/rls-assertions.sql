-- Sanity checks for row-level security, run as the `authenticated` role.
\set dev '11111111-1111-4111-8111-111111111111'
\set wren '22222222-2222-4222-8222-222222222222'
\set ON_ERROR_STOP on
set role authenticated;

-- as wren
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false) \gset
do $$ begin
  -- base table: only own rows
  if (select count(*) from public.sightings) <> 8 then raise exception 'wren should see only her 8 sightings in the base table'; end if;
  -- view: own 8 + dev public (28) + dev followers (1) = 37; private hidden
  if (select count(*) from public.public_sightings) <> 37 then raise exception 'wren public_sightings count: %', (select count(*) from public.public_sightings); end if;
  -- sensitive dev sighting: no coords
  if (select lat from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000010') is not null then raise exception 'sensitive sighting leaked coords'; end if;
  if (select location_hidden from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000010') is not true then raise exception 'location_hidden flag'; end if;
  -- backyard sighting within 500m of dev home is fuzzed and place name dropped
  if (select location_fuzzed from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000007') is not true then raise exception 'near-home sighting not fuzzed'; end if;
  if (select place_name from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000007') is not null then raise exception 'fuzzed place name leaked'; end if;
  if abs((select lat from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000007') - 47.6618) > 0.03 then raise exception 'fuzzed point too far from area'; end if;
  if (select lat from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000007') = 47.6618 then raise exception 'near-home sighting not moved'; end if;
  -- all fuzzed dev pins collapse to the same point
  if (select count(distinct (lat, lng)) from public.public_sightings where user_id = '11111111-1111-4111-8111-111111111111' and location_fuzzed) <> 1 then raise exception 'fuzzed pins should coincide'; end if;
  -- far sighting untouched
  if (select location_fuzzed from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000001') then raise exception 'far sighting fuzzed'; end if;
  -- profiles: cannot read dev home
  if (select count(*) from public.profiles) <> 1 then raise exception 'profiles base table leaked'; end if;
  if (select count(*) from public.public_profiles) <> 2 then raise exception 'public_profiles should list everyone'; end if;
  -- feed has both people's items
  if (select count(*) from public.feed(now(), 100)) < 30 then raise exception 'feed too small'; end if;
  if (select count(*) from public.feed(now(), 100) where kind = 'list') <> 3 then raise exception 'feed lists'; end if;
  -- life list: dev has 28 species visible to wren (spotow is private, robin twice)
  if (select count(*) from public.life_list where user_id = '11111111-1111-4111-8111-111111111111') <> 28 then raise exception 'life list count: %', (select count(*) from public.life_list where user_id = '11111111-1111-4111-8111-111111111111'); end if;
  -- engagement
  if (select like_count from public.engagement('sighting', array['c0000000-0000-4000-8000-000000000022'::uuid])) <> 1 then raise exception 'like count'; end if;
  if (select liked_by_me from public.engagement('sighting', array['c0000000-0000-4000-8000-000000000022'::uuid])) is not true then raise exception 'liked_by_me'; end if;
  if (select followers from public.profile_stats('11111111-1111-4111-8111-111111111111')) <> 1 then raise exception 'followers'; end if;
end $$;

-- wren cannot write dev rows
do $$ begin
  begin
    update public.sightings set note = 'hacked' where id = 'c0000000-0000-4000-8000-000000000001';
    if found then raise exception 'wren updated a dev sighting'; end if;
  end;
  begin
    insert into public.sightings (user_id, species_code) values ('11111111-1111-4111-8111-111111111111'::uuid, 'amerob');
    raise exception 'wren inserted as dev';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.comments (user_id, target_type, target_id, body) values ('22222222-2222-4222-8222-222222222222'::uuid, 'sighting', 'c0000000-0000-4000-8000-000000000027', 'on a private one');
    raise exception 'comment on private sighting allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.follows (follower_id, followee_id) values ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid);
    raise exception 'wren forged a follow';
  exception when insufficient_privilege or unique_violation then null; end;
end $$;

-- as dev: own coords are exact
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false) \gset
do $$ begin
  if (select lat from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000007') <> 47.6618 then raise exception 'owner should see exact coords'; end if;
  if (select count(*) from public.public_sightings where user_id = '11111111-1111-4111-8111-111111111111') <> 30 then raise exception 'dev should see all 30'; end if;
  if (select count(*) from public.sightings) <> 30 then raise exception 'dev base table'; end if;
  if (select home_lat from public.profiles where id = '11111111-1111-4111-8111-111111111111') is null then raise exception 'dev should read own home'; end if;
end $$;
reset role;

-- storage: sighting photos follow sighting visibility
reset role;
insert into storage.objects (bucket_id, name, owner) values
  ('sighting-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001.jpg', '11111111-1111-4111-8111-111111111111'), -- public robin
  ('sighting-photos', '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000027.jpg', '11111111-1111-4111-8111-111111111111'), -- private towhee
  ('sighting-photos', '11111111-1111-4111-8111-111111111111/orphan.jpg', '11111111-1111-4111-8111-111111111111');
update public.sightings set photo_path = '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000001.jpg' where id = 'c0000000-0000-4000-8000-000000000001';
update public.sightings set photo_path = '11111111-1111-4111-8111-111111111111/c0000000-0000-4000-8000-000000000027.jpg' where id = 'c0000000-0000-4000-8000-000000000027';
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false) \gset
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'sighting-photos') <> 1 then raise exception 'wren should see exactly the public photo, saw %', (select count(*) from storage.objects where bucket_id = 'sighting-photos'); end if;
  if not exists (select 1 from storage.objects where name like '%000001.jpg') then raise exception 'public photo hidden'; end if;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false) \gset
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'sighting-photos') <> 3 then raise exception 'owner should see all own photos'; end if;
end $$;
reset role;

-- follow approval: pending follows grant nothing
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false) \gset
update public.profiles set approve_followers = true where id = '11111111-1111-4111-8111-111111111111';
-- wren already follows dev (accepted, from seed); a new account would be pending. Simulate by flipping wren's edge to pending.
reset role;
update public.follows set status = 'pending' where follower_id = '22222222-2222-4222-8222-222222222222' and followee_id = '11111111-1111-4111-8111-111111111111';
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false) \gset
do $$ begin
  if exists (select 1 from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000009') then raise exception 'pending follower sees followers-only sighting'; end if;
  if (select follow_requested from public.profile_stats('11111111-1111-4111-8111-111111111111')) is not true then raise exception 'follow_requested flag'; end if;
  if (select followers from public.profile_stats('11111111-1111-4111-8111-111111111111')) <> 0 then raise exception 'pending counted as follower'; end if;
  -- likes on content wren cannot see are invisible
  if exists (select 1 from public.likes where target_id = 'c0000000-0000-4000-8000-000000000027') then raise exception 'like on private sighting visible'; end if;
  -- is_blocked only answers about me
  if public.is_blocked('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333') then raise exception 'is_blocked leaks third parties'; end if;
end $$;
-- dev accepts
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false) \gset
update public.follows set status = 'accepted' where followee_id = '11111111-1111-4111-8111-111111111111' and follower_id = '22222222-2222-4222-8222-222222222222';
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false) \gset
do $$ begin
  if not exists (select 1 from public.public_sightings where id = 'c0000000-0000-4000-8000-000000000009') then raise exception 'accepted follower cannot see followers-only sighting'; end if;
end $$;
-- content owner can delete a comment on their sighting
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false) \gset
do $$ begin
  delete from public.comments where target_id = 'c0000000-0000-4000-8000-000000000022' and user_id = '22222222-2222-4222-8222-222222222222';
  if not found then raise exception 'owner could not remove comment on own sighting'; end if;
end $$;
-- created_at is server stamped
do $$ declare c timestamptz; begin
  insert into public.lists (id, user_id, title, created_at) values ('aaaaaaaa-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'stamp test', '2000-01-01') returning created_at into c;
  if c < now() - interval '1 minute' then raise exception 'created_at not stamped'; end if;
end $$;
reset role;

-- blocks hide people from each other
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false) \gset
insert into public.blocks (blocker_id, blocked_id) values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');
do $$ begin
  if exists (select 1 from public.public_sightings where user_id = '11111111-1111-4111-8111-111111111111') then raise exception 'blocked user still visible'; end if;
  if exists (select 1 from public.search_profiles('dev')) then raise exception 'blocked user still searchable'; end if;
  if exists (select 1 from public.feed(now(), 100) where (payload->>'user_id') = '11111111-1111-4111-8111-111111111111') then raise exception 'blocked user still in feed'; end if;
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false) \gset
do $$ begin
  if exists (select 1 from public.public_sightings where user_id = '22222222-2222-4222-8222-222222222222') then raise exception 'block is not mutual'; end if;
  if exists (select 1 from public.blocks) then raise exception 'blocked party can see the block row'; end if;
end $$;
-- reports are write-only
insert into public.reports (reporter_id, target_type, target_id, reason) values ('11111111-1111-4111-8111-111111111111', 'sighting', 'd0000000-0000-4000-8000-000000000001', 'test');
do $$ begin
  if exists (select 1 from public.reports) then raise exception 'reports readable by users'; end if;
end $$;
-- account deletion removes everything
select public.delete_account();
reset role;
do $$ begin
  if exists (select 1 from auth.users where id = '11111111-1111-4111-8111-111111111111') then raise exception 'account not deleted'; end if;
  if exists (select 1 from public.sightings where user_id = '11111111-1111-4111-8111-111111111111') then raise exception 'sightings survived deletion'; end if;
  if exists (select 1 from storage.objects where name like '11111111-1111-4111-8111-111111111111/%') then raise exception 'photos survived deletion'; end if;
end $$;
