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
