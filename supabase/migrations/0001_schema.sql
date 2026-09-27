-- Flock core schema
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type public.visibility as enum ('public', 'followers', 'private');
create type public.sighting_source as enum ('app', 'ebird', 'merlin');
create type public.target_type as enum ('sighting', 'list');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 300),
  home_lat double precision,
  home_lng double precision,
  hide_home boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- species (bundled taxonomy)
create table public.species (
  code text primary key,
  common_name text not null,
  scientific_name text not null,
  family text not null,
  family_common text not null,
  taxonomic_order integer not null
);
create index species_common_name_idx on public.species (lower(common_name));

-- ---------------------------------------------------------------- sightings
create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  species_code text not null references public.species (code),
  observed_at timestamptz not null default now(),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  place_name text,
  photo_path text,
  note text not null default '' check (char_length(note) <= 2000),
  visibility public.visibility not null default 'public',
  sensitive boolean not null default false,
  source public.sighting_source not null default 'app',
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create index sightings_user_observed_idx on public.sightings (user_id, observed_at desc);
create index sightings_user_species_idx on public.sightings (user_id, species_code);
create index sightings_created_idx on public.sightings (created_at desc);
-- dedupe key for imports: same species, same day, same rounded location
create unique index sightings_import_dedupe_idx
  on public.sightings (user_id, species_code, ((timezone('UTC', observed_at))::date), (round(lat::numeric, 3)), (round(lng::numeric, 3)))
  where source <> 'app';

-- ---------------------------------------------------------------- lists
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_user_idx on public.lists (user_id, created_at desc);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  position integer not null default 0,
  species_code text references public.species (code),
  sighting_id uuid references public.sightings (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check ((species_code is null) <> (sighting_id is null))
);
create index list_items_list_idx on public.list_items (list_id, position);

-- ---------------------------------------------------------------- social
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.list_follows (
  user_id uuid not null references public.profiles (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index likes_target_idx on public.likes (target_type, target_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.target_type not null,
  target_id uuid not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_target_idx on public.comments (target_type, target_id, created_at);

-- ---------------------------------------------------------------- housekeeping triggers
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
-- Stamped on insert as well so the incremental pull watermark uses server time, not device clocks.
create trigger sightings_updated_at before insert or update on public.sightings for each row execute function public.set_updated_at();
create trigger lists_updated_at before update on public.lists for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user. Username comes from metadata or is derived from the email.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1), 'birder');
  base := lower(regexp_replace(base, '[^a-z0-9_]', '', 'gi'));
  if char_length(base) < 3 then base := 'birder' || base; end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', candidate),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Photos may only live under the owner's folder.
create or replace function public.check_sighting_photo_path() returns trigger
language plpgsql as $$
begin
  if new.photo_path is not null and position(new.user_id::text || '/' in new.photo_path) <> 1 then
    raise exception 'photo_path must start with the owner id';
  end if;
  return new;
end $$;
create trigger sightings_photo_path before insert or update on public.sightings
  for each row execute function public.check_sighting_photo_path();
