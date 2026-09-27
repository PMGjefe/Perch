# Perch

Letterboxd for birds. Perch is **not** an identification app: name the bird in Merlin or
eBird, then log it here. Perch is where your sightings live: a diary, a life list,
shareable lists, a map, and a chronological feed of the people you follow.

One codebase for iOS and Android: Expo (React Native, TypeScript, expo-router),
Supabase (Postgres, Auth, Storage), react-native-maps.

See [PLAN.md](PLAN.md) for the data model, screens and folder structure.

## What is in the MVP

| Feature | Where |
|---|---|
| Email/password, Sign in with Apple, Google sign-in | `src/lib/auth.tsx`, `src/app/(auth)` |
| One-tap "Log a bird": type-ahead over the bundled eBird/Clements v2025 taxonomy, auto date/time and GPS, photo from camera or library with EXIF date/location, note, visibility, sensitive flag. Works offline, syncs later | `src/components/SightingForm.tsx`, `src/lib/db.ts`, `src/lib/sync.ts` |
| Life list (first seen, count, photo), filter by year and place | `src/app/(tabs)/life.tsx` |
| Diary: chronological own sightings, list or map | `src/app/(tabs)/diary.tsx` |
| Lists: titled, ordered, species or sightings, public/private, followable | `src/app/list/` |
| Map with privacy: home fuzzing within 500 m, per-sighting sensitive flag | `supabase/migrations/0003_security.sql` (`public_sightings` view), `src/app/settings` |
| Social: follow, chronological feed, likes, comments. No ranking | `src/app/(tabs)/feed.tsx`, `src/app/user/` |
| Import eBird "My eBird Data" and Merlin CSV, deduped | `src/lib/csv.ts`, `src/app/settings/import.tsx` |
| Profile: photo, bio, counts, lists, followers | `src/app/(tabs)/me.tsx`, `src/app/user/[id]` |

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

Requires Node 20+. Dependencies are pinned to Expo SDK 57.

### 2. Supabase

You need a Supabase project: either the hosted service or the local stack via the
Supabase CLI.

**Hosted project**

1. Create a project at supabase.com and copy the project URL and anon key into `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
2. Apply the migrations. With the Supabase CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Or paste each file from `supabase/migrations/` into the SQL editor in order
   (`0001_schema.sql`, `0002_species_data.sql`, `0003_security.sql`).
3. Seed the dev account (optional, recommended so screens are not empty). In the SQL
   editor run `supabase/seed.sql`. It creates:

   | account | password | username |
   |---|---|---|
   | dev@perch.app | perchdev123 | dev |
   | wren@perch.app | perchdev123 | wren_k |

   `dev` has 30 sightings around Seattle, two lists, and follows `wren_k` (8 sightings
   in Portland, one list), with likes and comments between them.
4. Auth settings (Dashboard → Authentication → URL Configuration): add
   `perch://auth/callback` and, for Expo Go, `exp://127.0.0.1:8081/--/auth/callback`
   to the redirect URLs.
5. Storage: the migration creates a public bucket `sighting-photos`. Nothing else to do.

**Local stack (Docker)**

```bash
npx supabase start          # starts Postgres, Auth, Storage, Studio
npx supabase db reset       # applies migrations + seed.sql
```

Put the printed API URL and anon key in `.env`. On a physical device replace
`127.0.0.1` with your computer's LAN IP.

**Apple and Google sign-in**

- Apple: enable the provider in Supabase (Authentication → Providers → Apple) with your
  Services ID and key. The app uses the native Sign in with Apple sheet and passes the
  identity token to Supabase. iOS only; the button hides itself elsewhere.
- Google: enable the Google provider with an OAuth web client ID/secret. The app opens
  Supabase's hosted OAuth flow in the system browser and returns on `perch://auth/callback`.

Both work without any extra native SDKs. For the local CLI stack, fill the
`SUPABASE_AUTH_*` values in `.env` (see `supabase/config.toml`).

### 3. Run on a device

```bash
npx expo start
```

Scan the QR code with **Expo Go** (iOS or Android). Everything used here is in Expo Go
except Sign in with Apple, which needs a development build:

```bash
npx expo run:ios       # or: npx eas-cli build --profile development
```

Android maps in a development build need a Google Maps key in
`GOOGLE_MAPS_ANDROID_API_KEY` (Expo Go ships its own).

## Design

- Type: Fraunces (serif) for species names, headings and big numbers; Inter for UI.
- Motion: Reanimated everywhere it carries meaning. Cards rise in with a stagger, presses
  squash with a spring, lists animate layout changes, the sighting hero parallaxes.
- Haptics: logging, liking, lifting a card to reorder, and a heavy thump for a lifer.
- The lifer moment: logging a species for the first time opens a full-screen celebration
  with its life-list number (`src/components/LiferMoment.tsx`).
- Glass tab bar on iOS, dark map style at night, skeletons instead of spinners.
- Everything respects the system reduce-motion setting.

## Development

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint (eslint-config-expo)
npm run check         # both
npm run build:taxonomy   # regenerate assets/taxonomy/species.json + 0002 migration from scripts/ebird-taxonomy-v2025.csv
npm test              # jest unit tests (importer, taxonomy search, EXIF, formatting, photo cache)
npm run test:db       # apply migrations + seed to a local Postgres and run RLS assertions
```

`npm run test:db` needs a plain Postgres 15+ reachable through the usual `PG*` env
vars (it creates a `perch_test` database and a stub of Supabase's `auth`/`storage`
schemas). The assertions in `scripts/rls-assertions.sql` check that other users cannot
read private rows, exact coordinates of sensitive or near-home sightings, or home
locations.

## How privacy works

Other users never read the `sightings` table. They read the `public_sightings` view,
which

- drops private rows and followers-only rows from people they do not follow,
- nulls coordinates and place name when the sighting is marked **sensitive**,
- when the owner has set a home and **hide home** is on, replaces coordinates of any
  sighting within 500 m of home with one deterministic point inside the ~2 km grid
  cell containing the home (so averaging pins never reveals it) and drops the place
  name. The view flags these rows `location_fuzzed`, and the UI draws a circle.

Owners always see their own exact data. Home coordinates live on `profiles`, which is
only readable by its owner; everyone else reads `public_profiles`.

Photos follow the same rules: the storage policy on `sighting-photos` only serves an object
to its owner or to someone for whom the sighting appears in `public_sightings`, so making a
sighting private also hides its photo. The app fetches them through signed URLs.

## Offline

Your own sightings live in an on-device SQLite database (`expo-sqlite`) and are the
source of truth for the Log, Diary, Life list and Species screens. Every write marks the
row dirty; `src/lib/sync.ts` pushes dirty rows (and uploads photos) whenever the app is
foregrounded, the network comes back, or 800 ms after a write, then pulls the server copy
and prunes rows deleted elsewhere. Lists, feed, likes and comments require a connection.

## Dependencies

Expo packages, `@supabase/supabase-js` and `react-native-maps`, plus:

- `@react-native-community/datetimepicker` for the native date/time picker in the log form
  (inline compact picker on iOS, system dialogs on Android). Bundled with Expo Go.
- `expo-font` + `@expo-google-fonts/fraunces` and `@expo-google-fonts/inter`, `expo-haptics`,
  `expo-blur`, `expo-linear-gradient` for type, feedback and visual polish.
- `react-native-reorderable-list` for drag-and-drop reordering in the list editor, with its
  peers `react-native-reanimated` and `react-native-worklets` (both Expo-bundled and in Expo
  Go; `babel-preset-expo` registers the worklets plugin automatically).
- The peers expo-router requires (`react-native-screens`, `react-native-safe-area-context`,
  `react-native-gesture-handler`).

No state or query library. Auth session storage uses `expo-sqlite/kv-store` instead of
AsyncStorage. Dev tooling: `eslint` + `eslint-config-expo`.

## Known limits of the MVP

- Sightings cannot be dated in the future; a photo whose camera clock is ahead is set to now.
- Reordering a list is long-press-and-drag (with "Move up"/"Move down" screen-reader actions);
  the web build shows the date read-only since the picker is native-only.
- Merlin's export format is detected from its header (common name, date, location…);
  if Merlin changes the columns, `src/lib/csv.ts` `findCol` is the place to adjust.
