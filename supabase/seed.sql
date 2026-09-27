-- Development seed: two accounts, 30+ sightings, lists, follows, likes and comments.
-- Dev account:    dev@flock.app    / flockdev123   (username: dev)
-- Friend account: wren@flock.app   / flockdev123   (username: wren_k)
-- Apply with `supabase db reset` (runs migrations then this file).

do $$
declare
  dev uuid := '11111111-1111-4111-8111-111111111111';
  wren uuid := '22222222-2222-4222-8222-222222222222';
  l_commute uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  l_best uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  l_wren uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  pw text := crypt('flockdev123', gen_salt('bf'));
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  values
    ('00000000-0000-0000-0000-000000000000', dev, 'authenticated', 'authenticated', 'dev@flock.app', pw, now(),
     '{"provider":"email","providers":["email"]}', '{"username":"dev","full_name":"Dev Birder"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', wren, 'authenticated', 'authenticated', 'wren@flock.app', pw, now(),
     '{"provider":"email","providers":["email"]}', '{"username":"wren_k","full_name":"Wren Kowalski"}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), dev, dev::text, jsonb_build_object('sub', dev, 'email', 'dev@flock.app', 'email_verified', true), 'email', now(), now(), now()),
    (gen_random_uuid(), wren, wren::text, jsonb_build_object('sub', wren, 'email', 'wren@flock.app', 'email_verified', true), 'email', now(), now(), now())
  on conflict do nothing;

  -- profiles are created by the auth trigger; fill in the rest
  update public.profiles set bio = 'Seattle. Mostly patch birding, occasionally the coast.', home_lat = 47.6615, home_lng = -122.3343, hide_home = true where id = dev;
  update public.profiles set bio = 'Portland birder. Owls and gulls.', home_lat = 45.5152, home_lng = -122.6784, hide_home = true where id = wren;

  -- ---------------------------------------------------------------- dev sightings (30)
  insert into public.sightings (id, user_id, species_code, observed_at, lat, lng, place_name, note, visibility, sensitive, source) values
    ('c0000000-0000-4000-8000-000000000001', dev, 'amerob',  '2025-01-04 08:12-08', 47.6205, -122.3493, 'Discovery Park', 'First bird of the year, naturally.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000002', dev, 'stejay',  '2025-01-04 08:40-08', 47.6580, -122.4090, 'Discovery Park', 'Loud pair near the loop trail.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000003', dev, 'pacwre1', '2025-01-04 09:05-08', 47.6590, -122.4120, 'Discovery Park', 'Singing from the understory, finally got a look.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000004', dev, 'buffle',  '2025-01-18 15:20-08', 47.6801, -122.3390, 'Green Lake', '', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000005', dev, 'hoomer',  '2025-01-18 15:31-08', 47.6790, -122.3420, 'Green Lake', 'Two drakes, one hen. Crests up.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000006', dev, 'pibgre',  '2025-01-18 15:45-08', 47.6812, -122.3355, 'Green Lake', '', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000007', dev, 'annhum',  '2025-02-02 07:55-08', 47.6618, -122.3348, 'Backyard', 'On the feeder before sunrise.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000008', dev, 'bkcchi',  '2025-02-02 08:01-08', 47.6620, -122.3340, 'Backyard', '', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000009', dev, 'daejun',  '2025-02-02 08:03-08', 47.6613, -122.3350, 'Backyard', 'Oregon form, as always.', 'followers', false, 'app'),
    ('c0000000-0000-4000-8000-000000000010', dev, 'brdowl',  '2025-03-09 19:40-07', 47.6650, -122.3300, 'Wallingford', 'Nest tree. Keeping this one quiet.', 'public', true, 'app'),
    ('c0000000-0000-4000-8000-000000000011', dev, 'varthr',  '2025-03-15 10:10-07', 47.6540, -122.4150, 'Discovery Park', 'Heard the eerie whistle before seeing it.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000012', dev, 'rebsap',  '2025-03-15 10:50-07', 47.6555, -122.4100, 'Discovery Park', 'Working a birch, neat rows of wells.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000013', dev, 'vigswa',  '2025-04-05 12:30-07', 47.6530, -122.2940, 'Union Bay Natural Area', 'First swallows of spring.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000014', dev, 'yerwar',  '2025-04-05 12:45-07', 47.6525, -122.2950, 'Union Bay Natural Area', 'Audubon''s.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000015', dev, 'osprey',  '2025-04-19 14:00-07', 47.6520, -122.2920, 'Union Bay Natural Area', 'Carrying a fish toward the stadium platform.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000016', dev, 'baleag',  '2025-04-19 14:20-07', 47.6510, -122.2960, 'Union Bay Natural Area', '', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000017', dev, 'comyel',  '2025-05-10 07:30-07', 47.6535, -122.2935, 'Union Bay Natural Area', 'Witchety-witchety from the cattails.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000018', dev, 'wlswar',  '2025-05-10 07:52-07', 47.6540, -122.2925, 'Union Bay Natural Area', 'Year bird.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000019', dev, 'cedwax',  '2025-06-21 18:15-07', 47.6200, -122.3350, 'Volunteer Park', 'Flock of ~20 in the cherries.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000020', dev, 'pilwoo',  '2025-07-06 09:00-07', 47.6560, -122.4080, 'Discovery Park', 'Huge. Never gets old.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000021', dev, 'piggui',  '2025-07-06 10:30-07', 47.6620, -122.4180, 'West Point', 'Red feet, in the surf.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000022', dev, 'rhiauk',  '2025-07-06 10:45-07', 47.6630, -122.4200, 'West Point', 'Distant, but the horn was clear in the scope.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000023', dev, 'sursco',  '2025-10-25 11:00-07', 47.6625, -122.4190, 'West Point', 'Fall arrivals.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000024', dev, 'gockin',  '2025-11-08 13:10-08', 47.6545, -122.4130, 'Discovery Park', 'Mixed flock with chickadees.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000025', dev, 'ruckin',  '2025-11-08 13:12-08', 47.6547, -122.4128, 'Discovery Park', '', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000026', dev, 'norfli',  '2026-01-01 09:30-08', 47.6616, -122.3345, 'Backyard', 'New year, same flicker on the suet.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000027', dev, 'spotow',  '2026-01-01 09:35-08', 47.6614, -122.3347, 'Backyard', '', 'private', false, 'app'),
    ('c0000000-0000-4000-8000-000000000028', dev, 'belkin1', '2026-02-14 16:00-08', 47.6795, -122.3410, 'Green Lake', 'Rattling over the water.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000029', dev, 'wooduc',  '2026-02-14 16:10-08', 47.6785, -122.3400, 'Green Lake', 'Drake in full plumage.', 'public', false, 'app'),
    ('c0000000-0000-4000-8000-000000000030', dev, 'amerob',  '2026-03-21 07:00-07', 47.6180, -122.3500, 'Seward Park', 'Dawn chorus is back.', 'public', false, 'app');

  -- ---------------------------------------------------------------- wren sightings (8)
  insert into public.sightings (id, user_id, species_code, observed_at, lat, lng, place_name, note, visibility, sensitive, source) values
    ('d0000000-0000-4000-8000-000000000001', wren, 'grhowl',  '2026-01-10 18:05-08', 45.5060, -122.6300, 'Mt Tabor', 'Duetting pair at dusk.', 'public', true, 'app'),
    ('d0000000-0000-4000-8000-000000000002', wren, 'glwgul',  '2026-01-25 12:00-08', 45.5180, -122.6700, 'Waterfront Park', 'Olympic-ish hybrid soup.', 'public', false, 'app'),
    ('d0000000-0000-4000-8000-000000000003', wren, 'comrav',  '2026-02-08 09:30-08', 45.5720, -122.7600, 'Forest Park', 'Croaking overhead the whole hike.', 'public', false, 'app'),
    ('d0000000-0000-4000-8000-000000000004', wren, 'bewwre',  '2026-02-08 10:15-08', 45.5700, -122.7580, 'Forest Park', '', 'public', false, 'app'),
    ('d0000000-0000-4000-8000-000000000005', wren, 'turvul',  '2026-03-01 14:00-08', 45.5100, -122.6350, 'Mt Tabor', 'First of the year, right on schedule.', 'public', false, 'app'),
    ('d0000000-0000-4000-8000-000000000006', wren, 'norpin',  '2026-03-07 11:20-08', 45.6120, -122.7580, 'Smith and Bybee Wetlands', 'Elegant.', 'public', false, 'app'),
    ('d0000000-0000-4000-8000-000000000007', wren, 'wesblu',  '2026-03-14 10:00-07', 45.5155, -122.6780, 'Backyard', 'Yard first!', 'followers', false, 'app'),
    ('d0000000-0000-4000-8000-000000000008', wren, 'bkcchi',  '2026-03-20 08:00-07', 45.5150, -122.6790, 'Backyard', '', 'public', false, 'app');

  -- ---------------------------------------------------------------- lists
  insert into public.lists (id, user_id, title, description, is_public, created_at) values
    (l_commute, dev, 'Birds of my commute', 'What I see on the bike path between Wallingford and the U District.', true, '2025-05-01 10:00-07'),
    (l_best, dev, 'Best of 2025', 'The sightings I keep thinking about.', true, '2025-12-30 20:00-08'),
    (l_wren, wren, 'Portland owls', 'Every owl I have found in the city limits.', true, '2026-01-11 09:00-08');

  insert into public.list_items (list_id, position, species_code, note) values
    (l_commute, 0, 'amecro', 'Every single day.'),
    (l_commute, 1, 'sonspa', ''),
    (l_commute, 2, 'annhum', 'Sits on the same wire by the bridge.'),
    (l_commute, 3, 'glwgul', ''),
    (l_commute, 4, 'doccor', 'Drying wings on the log booms.'),
    (l_commute, 5, 'cangoo', 'Unfortunately.');
  insert into public.list_items (list_id, position, sighting_id, note) values
    (l_best, 0, 'c0000000-0000-4000-8000-000000000022', 'Lifer.'),
    (l_best, 1, 'c0000000-0000-4000-8000-000000000011', ''),
    (l_best, 2, 'c0000000-0000-4000-8000-000000000015', ''),
    (l_best, 3, 'c0000000-0000-4000-8000-000000000020', '');
  insert into public.list_items (list_id, position, species_code, note) values
    (l_wren, 0, 'grhowl', 'Mt Tabor pair.'),
    (l_wren, 1, 'brdowl', 'Forest Park, several.');

  -- ---------------------------------------------------------------- social
  insert into public.follows (follower_id, followee_id) values (dev, wren), (wren, dev);
  insert into public.list_follows (user_id, list_id) values (dev, l_wren), (wren, l_commute);
  insert into public.likes (user_id, target_type, target_id) values
    (wren, 'sighting', 'c0000000-0000-4000-8000-000000000022'),
    (wren, 'sighting', 'c0000000-0000-4000-8000-000000000020'),
    (wren, 'list', l_best),
    (dev, 'sighting', 'd0000000-0000-4000-8000-000000000006'),
    (dev, 'list', l_wren);
  insert into public.comments (user_id, target_type, target_id, body, created_at) values
    (wren, 'sighting', 'c0000000-0000-4000-8000-000000000022', 'Jealous. Still need Rhino for the year.', '2025-07-06 20:00-07'),
    (dev, 'sighting', 'c0000000-0000-4000-8000-000000000022', 'Come up in July, they were everywhere off the point.', '2025-07-06 21:15-07'),
    (dev, 'sighting', 'd0000000-0000-4000-8000-000000000006', 'Best duck.', '2026-03-07 18:00-08'),
    (wren, 'list', l_best, 'Strong list. Varied Thrush deserves it.', '2025-12-31 09:00-08');
end $$;
