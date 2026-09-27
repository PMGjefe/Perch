export type Visibility = 'public' | 'followers' | 'private';
export type SightingSource = 'app' | 'ebird' | 'merlin';
export type TargetType = 'sighting' | 'list';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  home_lat: number | null;
  home_lng: number | null;
  hide_home: boolean;
  created_at: string;
  updated_at: string;
}

export type PublicProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'bio' | 'created_at'>;

export interface Species {
  code: string;
  common_name: string;
  scientific_name: string;
  family: string;
  family_common: string;
  taxonomic_order: number;
}

export interface Sighting {
  id: string;
  user_id: string;
  species_code: string;
  observed_at: string;
  lat: number | null;
  lng: number | null;
  place_name: string | null;
  photo_path: string | null;
  note: string;
  visibility: Visibility;
  sensitive: boolean;
  source: SightingSource;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
}

/** A row of the `public_sightings` view: what other users (and the owner) see. */
export interface PublicSighting extends Sighting {
  location_fuzzed: boolean;
  location_hidden: boolean;
}

export interface List {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  position: number;
  species_code: string | null;
  sighting_id: string | null;
  note: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  target_type: TargetType;
  target_id: string;
  body: string;
  created_at: string;
}

export interface Engagement {
  target_id: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface ProfileStats {
  followers: number;
  following: number;
  species_count: number;
  sighting_count: number;
  list_count: number;
  is_followed_by_me: boolean;
}

export interface LifeListRow {
  user_id: string;
  species_code: string;
  first_seen: string;
  sighting_count: number;
  photo_path: string | null;
  first_sighting_id: string;
}

export type FeedItem =
  | { kind: 'sighting'; created_at: string; payload: PublicSighting }
  | { kind: 'list'; created_at: string; payload: List };
