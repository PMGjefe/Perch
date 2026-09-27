-- Development seed: two accounts, 30+ sightings, lists, follows, likes and comments.
-- Dev account:    dev@flock.app    / flockdev123   (username: dev)
-- Friend account: wren@flock.app   / flockdev123   (username: wren_k)
-- Apply with `supabase db reset` (runs migrations then this file).
--
-- Sample photos are hotlinked from Unsplash (Unsplash License) for development only; the app
-- accepts absolute URLs in photo_path. Photographers:
--   amerob: Trac Vu, https://unsplash.com/photos/gray-and-orange-bird-on-brown-soil-during-daytime-sO4mAuM96Fc
--   baleag: Mathew Schwartz, https://unsplash.com/photos/bald-eagle-flying-on-skies-OjQgsR1oyEw
--   belkin1: Joshua J. Cotten, https://unsplash.com/photos/blue-and-white-bird-on-brown-rope-G9Aq-zTTvaw
--   bewwre: anish lakkapragada, https://unsplash.com/photos/a-small-bird-perched-on-a-tree-branch-EsPQev6YakY
--   bkcchi: Margaret Strickland, https://unsplash.com/photos/a-small-bird-perched-on-a-tree-branch-qY9vOjKadec
--   brdowl: Philip Brown, https://unsplash.com/photos/white-and-brown-owl-on-tree-during-daytime-16TAZQOPKyo
--   cedwax: Camerauthor Photos, https://unsplash.com/photos/a-bird-sitting-on-top-of-a-rock-next-to-a-body-of-water-uFWEtalHC2s
--   comrav: Anastasiya Dalenka, https://unsplash.com/photos/a-black-bird-sitting-on-top-of-a-wooden-post-7iwKvbL3-UE
--   comyel: Patrice Bouchard, https://unsplash.com/photos/yellow-and-black-bird-on-tree-branch-BvFp9BerH_A
--   daejun: Mark Olsen, https://unsplash.com/photos/gray-and-white-bird-on-brown-tree-branch-8EYm1qcAniY
--   glwgul: Vidar Nordli-Mathisen, https://unsplash.com/photos/young-gull-flying-on-sky-lzDUUjjYKzk
--   grhowl: Michael Chambers, https://unsplash.com/photos/brown-owl-on-brown-tree-branch-during-daytime-oSNiQ8RLCew
--   hoomer: Camerauthor Photos, https://unsplash.com/photos/a-duck-floating-on-top-of-a-body-of-water-4OjFItqskr4
--   norfli: Margaret Strickland, https://unsplash.com/photos/a-bird-perched-on-a-branch-of-a-tree-U_Ws7oU1u2Q
--   norpin: Aleksandar Popovski, https://unsplash.com/photos/a-duck-floating-on-top-of-a-body-of-water-KvBmoX96gn0
--   osprey: Mathew Schwartz, https://unsplash.com/photos/selective-focus-photography-of-bald-eagle-i4Y9hr5dxKc
--   pibgre: Mathew Schwartz, https://unsplash.com/photos/a-duck-flapping-its-wings-in-the-water-nQOt2BEfL3c
--   pilwoo: Patrice Bouchard, https://unsplash.com/photos/black-and-white-bird-on-tree-branch-during-daytime-r-pTI_dAU4I
--   rebsap: John Yunker, https://unsplash.com/photos/red-and-black-bird-on-tree-trunk-mhHHPmgpn90
--   spotow: anish lakkapragada, https://unsplash.com/photos/a-small-bird-perched-on-a-tree-branch-n4hEnJTmonE
--   stejay: Bryan Hanson, https://unsplash.com/photos/black-bird-aXUhoMlbLKk
--   turvul: Joshua J. Cotten, https://unsplash.com/photos/brown-and-white-bird-on-brown-grass-during-daytime-uxcZrZCiOok
--   vigswa: christie greene, https://unsplash.com/photos/green-and-white-bird-on-brown-tree-branch-j5g6WfKhQ30
--   wesblu: anish lakkapragada, https://unsplash.com/photos/a-blue-bird-sitting-on-a-branch-of-a-tree-1WpD-sm6PBU
--   wlswar: Patrice Bouchard, https://unsplash.com/photos/yellow-and-green-bird-on-tree-branch-V8nt-EeGZQM
--   wooduc: Joshua J. Cotten, https://unsplash.com/photos/green-brown-and-black-duck-c6hbV7t87sQ
--   yerwar: anish lakkapragada, https://unsplash.com/photos/a-small-bird-perched-on-a-branch-of-a-tree-JVPXDLPQuOI

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
  insert into public.sightings (id, user_id, species_code, observed_at, lat, lng, place_name, note, visibility, sensitive, source, photo_path) values
    ('c0000000-0000-4000-8000-000000000001', dev, 'amerob',  '2025-01-04 08:12-08', 47.6205, -122.3493, 'Discovery Park', 'First bird of the year, naturally.', 'public', false, 'app', 'https://images.unsplash.com/photo-1616720072185-8b281d6538ca?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000002', dev, 'stejay',  '2025-01-04 08:40-08', 47.6580, -122.4090, 'Discovery Park', 'Loud pair near the loop trail.', 'public', false, 'app', 'https://images.unsplash.com/photo-1564239456204-0c811ae42a3a?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000003', dev, 'pacwre1', '2025-01-04 09:05-08', 47.6590, -122.4120, 'Discovery Park', 'Singing from the understory, finally got a look.', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000004', dev, 'buffle',  '2025-01-18 15:20-08', 47.6801, -122.3390, 'Green Lake', '', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000005', dev, 'hoomer',  '2025-01-18 15:31-08', 47.6790, -122.3420, 'Green Lake', 'Two drakes, one hen. Crests up.', 'public', false, 'app', 'https://images.unsplash.com/photo-1700705241679-967b0b515ac3?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000006', dev, 'pibgre',  '2025-01-18 15:45-08', 47.6812, -122.3355, 'Green Lake', '', 'public', false, 'app', 'https://images.unsplash.com/photo-1642081117189-9fda3be13009?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000007', dev, 'annhum',  '2025-02-02 07:55-08', 47.6618, -122.3348, 'Backyard', 'On the feeder before sunrise.', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000008', dev, 'bkcchi',  '2025-02-02 08:01-08', 47.6620, -122.3340, 'Backyard', '', 'public', false, 'app', 'https://images.unsplash.com/photo-1674431074456-82f2a6ea34da?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000009', dev, 'daejun',  '2025-02-02 08:03-08', 47.6613, -122.3350, 'Backyard', 'Oregon form, as always.', 'followers', false, 'app', 'https://images.unsplash.com/photo-1613164563503-902995c92402?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000010', dev, 'brdowl',  '2025-03-09 19:40-07', 47.6650, -122.3300, 'Wallingford', 'Nest tree. Keeping this one quiet.', 'public', true, 'app', 'https://images.unsplash.com/photo-1517517666444-6978df380b74?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000011', dev, 'varthr',  '2025-03-15 10:10-07', 47.6540, -122.4150, 'Discovery Park', 'Heard the eerie whistle before seeing it.', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000012', dev, 'rebsap',  '2025-03-15 10:50-07', 47.6555, -122.4100, 'Discovery Park', 'Working a birch, neat rows of wells.', 'public', false, 'app', 'https://images.unsplash.com/photo-1550958200-73db1b7809e1?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000013', dev, 'vigswa',  '2025-04-05 12:30-07', 47.6530, -122.2940, 'Union Bay Natural Area', 'First swallows of spring.', 'public', false, 'app', 'https://images.unsplash.com/photo-1605770006803-d23d56a7bab2?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000014', dev, 'yerwar',  '2025-04-05 12:45-07', 47.6525, -122.2950, 'Union Bay Natural Area', 'Audubon''s.', 'public', false, 'app', 'https://images.unsplash.com/photo-1703583502443-3a85213645a7?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000015', dev, 'osprey',  '2025-04-19 14:00-07', 47.6520, -122.2920, 'Union Bay Natural Area', 'Carrying a fish toward the stadium platform.', 'public', false, 'app', 'https://images.unsplash.com/photo-1559403053-900e0c4abc8c?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000016', dev, 'baleag',  '2025-04-19 14:20-07', 47.6510, -122.2960, 'Union Bay Natural Area', '', 'public', false, 'app', 'https://images.unsplash.com/photo-1557401622-cfc0aa5d146c?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000017', dev, 'comyel',  '2025-05-10 07:30-07', 47.6535, -122.2935, 'Union Bay Natural Area', 'Witchety-witchety from the cattails.', 'public', false, 'app', 'https://images.unsplash.com/photo-1618082335435-32b746dabe48?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000018', dev, 'wlswar',  '2025-05-10 07:52-07', 47.6540, -122.2925, 'Union Bay Natural Area', 'Year bird.', 'public', false, 'app', 'https://images.unsplash.com/photo-1617995765952-b9b9a2ad992d?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000019', dev, 'cedwax',  '2025-06-21 18:15-07', 47.6200, -122.3350, 'Volunteer Park', 'Flock of ~20 in the cherries.', 'public', false, 'app', 'https://images.unsplash.com/photo-1725672321041-4a821cc4be96?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000020', dev, 'pilwoo',  '2025-07-06 09:00-07', 47.6560, -122.4080, 'Discovery Park', 'Huge. Never gets old.', 'public', false, 'app', 'https://images.unsplash.com/photo-1611005336745-17abe0bcf035?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000021', dev, 'piggui',  '2025-07-06 10:30-07', 47.6620, -122.4180, 'West Point', 'Red feet, in the surf.', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000022', dev, 'rhiauk',  '2025-07-06 10:45-07', 47.6630, -122.4200, 'West Point', 'Distant, but the horn was clear in the scope.', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000023', dev, 'sursco',  '2025-10-25 11:00-07', 47.6625, -122.4190, 'West Point', 'Fall arrivals.', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000024', dev, 'gockin',  '2025-11-08 13:10-08', 47.6545, -122.4130, 'Discovery Park', 'Mixed flock with chickadees.', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000025', dev, 'ruckin',  '2025-11-08 13:12-08', 47.6547, -122.4128, 'Discovery Park', '', 'public', false, 'app', null),
    ('c0000000-0000-4000-8000-000000000026', dev, 'norfli',  '2026-01-01 09:30-08', 47.6616, -122.3345, 'Backyard', 'New year, same flicker on the suet.', 'public', false, 'app', 'https://images.unsplash.com/photo-1677641782896-d10fcbf58e49?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000027', dev, 'spotow',  '2026-01-01 09:35-08', 47.6614, -122.3347, 'Backyard', '', 'private', false, 'app', 'https://images.unsplash.com/photo-1707630453947-f2a61fc01c88?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000028', dev, 'belkin1', '2026-02-14 16:00-08', 47.6795, -122.3410, 'Green Lake', 'Rattling over the water.', 'public', false, 'app', 'https://images.unsplash.com/photo-1623974108307-968b9f796921?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000029', dev, 'wooduc',  '2026-02-14 16:10-08', 47.6785, -122.3400, 'Green Lake', 'Drake in full plumage.', 'public', false, 'app', 'https://images.unsplash.com/photo-1577049212826-147af542a379?w=1080&q=80&fm=jpg&fit=max'),
    ('c0000000-0000-4000-8000-000000000030', dev, 'amerob',  '2026-03-21 07:00-07', 47.6180, -122.3500, 'Seward Park', 'Dawn chorus is back.', 'public', false, 'app', 'https://images.unsplash.com/photo-1616720072185-8b281d6538ca?w=1080&q=80&fm=jpg&fit=max');

  -- ---------------------------------------------------------------- wren sightings (8)
  insert into public.sightings (id, user_id, species_code, observed_at, lat, lng, place_name, note, visibility, sensitive, source, photo_path) values
    ('d0000000-0000-4000-8000-000000000001', wren, 'grhowl',  '2026-01-10 18:05-08', 45.5060, -122.6300, 'Mt Tabor', 'Duetting pair at dusk.', 'public', true, 'app', 'https://images.unsplash.com/photo-1590547290164-2e3359e18ac4?w=1080&q=80&fm=jpg&fit=max'),
    ('d0000000-0000-4000-8000-000000000002', wren, 'glwgul',  '2026-01-25 12:00-08', 45.5180, -122.6700, 'Waterfront Park', 'Olympic-ish hybrid soup.', 'public', false, 'app', 'https://images.unsplash.com/photo-1519678041002-3f3bf7705905?w=1080&q=80&fm=jpg&fit=max'),
    ('d0000000-0000-4000-8000-000000000003', wren, 'comrav',  '2026-02-08 09:30-08', 45.5720, -122.7600, 'Forest Park', 'Croaking overhead the whole hike.', 'public', false, 'app', 'https://images.unsplash.com/photo-1698720902874-a54715b5f22f?w=1080&q=80&fm=jpg&fit=max'),
    ('d0000000-0000-4000-8000-000000000004', wren, 'bewwre',  '2026-02-08 10:15-08', 45.5700, -122.7580, 'Forest Park', '', 'public', false, 'app', 'https://images.unsplash.com/photo-1688937460660-66d396ab3f5b?w=1080&q=80&fm=jpg&fit=max'),
    ('d0000000-0000-4000-8000-000000000005', wren, 'turvul',  '2026-03-01 14:00-08', 45.5100, -122.6350, 'Mt Tabor', 'First of the year, right on schedule.', 'public', false, 'app', 'https://images.unsplash.com/photo-1598216896034-2b95ae45f24b?w=1080&q=80&fm=jpg&fit=max'),
    ('d0000000-0000-4000-8000-000000000006', wren, 'norpin',  '2026-03-07 11:20-08', 45.6120, -122.7580, 'Smith and Bybee Wetlands', 'Elegant.', 'public', false, 'app', 'https://images.unsplash.com/photo-1675194202941-05c22fc8879f?w=1080&q=80&fm=jpg&fit=max'),
    ('d0000000-0000-4000-8000-000000000007', wren, 'wesblu',  '2026-03-14 10:00-07', 45.5155, -122.6780, 'Backyard', 'Yard first!', 'followers', false, 'app', 'https://images.unsplash.com/photo-1676877426700-2028ac513765?w=1080&q=80&fm=jpg&fit=max'),
    ('d0000000-0000-4000-8000-000000000008', wren, 'bkcchi',  '2026-03-20 08:00-07', 45.5150, -122.6790, 'Backyard', '', 'public', false, 'app', 'https://images.unsplash.com/photo-1674431074456-82f2a6ea34da?w=1080&q=80&fm=jpg&fit=max');

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
