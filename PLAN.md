# Flock — MVP plan

"Letterboxd for birds." Not an identification app: users identify birds elsewhere
(Merlin, eBird) and log the sighting here. Flock is where sightings live: a diary,
a life list, shareable lists, a map, and a friends' feed.

## Stack

- Expo SDK 57 (React Native 0.86, TypeScript, expo-router), one codebase for iOS + Android
- Supabase: Postgres + RLS, Auth (email/password, Apple, Google), Storage (photos)
- react-native-maps (Apple Maps on iOS, Google Maps on Android)
- Offline: expo-sqlite is the local source of truth for the user's own sightings;
  a sync queue pushes to Supabase when online and pulls the server copy back.
- No state library, no query library. Small hooks over the Supabase client and SQLite.

## Data model (Supabase / Postgres)

All tables have row-level security. `auth.uid()` is the caller.

| table         | key columns                                                                                                   | notes |
|---------------|---------------------------------------------------------------------------------------------------------------|-------|
| `profiles`    | `id` (= auth.users.id), `username`, `display_name`, `avatar_url`, `bio`, `home_lat`, `home_lng`, `hide_home`  | created by trigger on sign-up. Home coordinates are readable only by the owner (exposed via `public_profiles` view). |
| `species`     | `code` (eBird species code), `common_name`, `scientific_name`, `family`, `family_common`, `taxonomic_order`   | bundled eBird/Clements v2025 taxonomy, species only (~11k rows). Read-only. Also shipped in the app as JSON for offline type-ahead. |
| `sightings`   | `id` (client-generated uuid), `user_id`, `species_code`, `observed_at`, `lat`, `lng`, `place_name`, `photo_path`, `note`, `visibility` (`public`/`followers`/`private`), `sensitive`, `source` (`app`/`ebird`/`merlin`), `source_ref`, `updated_at` | RLS: owner has full access. Other users never read the base table; they read `public_sightings`. |
| `lists`       | `id`, `user_id`, `title`, `description`, `is_public`                                                          | |
| `list_items`  | `id`, `list_id`, `position`, `species_code` or `sighting_id`, `note`                                          | exactly one of species/sighting set |
| `follows`     | `follower_id`, `followee_id`                                                                                  | user follows user |
| `list_follows`| `user_id`, `list_id`                                                                                          | user follows a list |
| `likes`       | `user_id`, `target_type` (`sighting`/`list`), `target_id`                                                     | |
| `comments`    | `id`, `user_id`, `target_type`, `target_id`, `body`                                                           | |

Views (security definer, RLS-equivalent filtering baked in):

- `public_sightings` — sightings visible to the caller: own rows, `public` rows, and
  `followers` rows from people the caller follows. For rows the caller does not own it
  (a) nulls `lat`/`lng`/`place_name` when `sensitive`, (b) fuzzes `lat`/`lng` to a
  deterministic point when the sighting is within 500 m of the owner's home and the
  owner has `hide_home` on. Column `location_fuzzed` tells the UI to draw a circle
  instead of a pin.
- `public_profiles` — profiles without home coordinates.
- `life_list` — per-user aggregate: species, first seen, count, a photo.

Functions: `feed(before, limit)` returns followed users' public sightings and lists
in reverse chronological order (no ranking), `like_counts`, `comment_counts`.

Storage: bucket `sighting-photos`, path `<user_id>/<sighting_id>.jpg`. Owner can
write; anyone can read (paths are unguessable uuids).

## Screens (expo-router, `src/app`)

```
(auth)/sign-in            email/password, Apple, Google
(auth)/sign-up
(tabs)/feed               followed users' sightings + lists, likes, comments
(tabs)/diary              own sightings: chronological list | map toggle
(tabs)/log                "Log a bird" — species type-ahead, auto date/GPS, photo, note
(tabs)/life               life list, filter by year / place
(tabs)/me                 profile, lists, followers, settings, import
sighting/[id]             detail: photo, species, place, likes, comments, edit/delete
sighting/edit/[id]        edit an existing sighting
species/[code]            species page: your sightings of it
list/[id]                 list detail (follow, like, comment, reorder if owner)
list/edit/[id]            create / edit a list (title, description, public, items)
user/[id]                 another user's profile + follow button
user/[id]/followers       followers / following
search                    find users by username
settings                  edit profile, home location, hide-home, sign out
settings/import           CSV import (eBird "My eBird Data", Merlin saved birds)
```

## Folder structure

```
flock/
  app.json                 Expo config (scheme, plugins, permissions)
  src/
    app/                   routes (above)
    components/            UI: Screen, Text, Button, SightingCard, SpeciesPicker, MapPins…
    lib/
      supabase.ts          client (auth persisted in expo-sqlite kv-store)
      db.ts                local SQLite schema + queries
      sync.ts              push pending changes, upload photos, pull server copy
      taxonomy.ts          bundled species search
      geo.ts               distance, fuzzing preview, reverse geocode
      csv.ts               CSV parser + eBird / Merlin importers
      theme.ts             colors, spacing, light/dark
    hooks/                 useAuth, useSession, useSightings, useFeed…
    types/                 database types
  assets/taxonomy/species.json   trimmed taxonomy (code, common, scientific, family)
  scripts/build-taxonomy.mjs     CSV -> JSON + SQL migration
  supabase/
    config.toml
    migrations/            0001 schema, 0002 species data, 0003 policies/views/functions
    seed.sql               dev account + 30 sightings, a friend account, follows, likes
```

## Build order

1. Scaffold, theme, auth (email/password, Apple, Google) — commit
2. Taxonomy + migrations + seed — commit
3. Log-a-bird flow with offline queue + sync — commit
4. Life list — commit
5. Diary — commit
6. Lists — commit
7. Map + privacy — commit
8. Social: follows, feed, likes, comments — commit
9. Import (eBird, Merlin) — commit
10. Profile + README — commit

Status: all ten steps built. See README.md for setup.
