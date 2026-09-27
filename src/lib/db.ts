// Local SQLite store: the source of truth for the signed-in user's own sightings.
// Rows carry `dirty` (needs push) and `deleted` (tombstone until the delete is pushed).
import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import type { Sighting } from '@/types/db';

export interface LocalSighting extends Sighting {
  local_photo_uri: string | null;
  dirty: number;
  deleted: number;
}

const db = SQLite.openDatabaseSync('flock.db');

db.execSync(`
  pragma journal_mode = wal;
  create table if not exists sightings (
    id text primary key,
    user_id text not null,
    species_code text not null,
    observed_at text not null,
    lat real, lng real,
    place_name text,
    photo_path text,
    local_photo_uri text,
    note text not null default '',
    visibility text not null default 'public',
    sensitive integer not null default 0,
    source text not null default 'app',
    source_ref text,
    created_at text not null,
    updated_at text not null,
    dirty integer not null default 1,
    deleted integer not null default 0
  );
  create index if not exists sightings_user_observed on sightings (user_id, observed_at desc);
  create table if not exists meta (key text primary key, value text);
`);

// ---------------------------------------------------------------- change notifications
const listeners = new Set<() => void>();
let version = 0;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify() {
  version++;
  listeners.forEach((fn) => fn());
}
const getVersion = () => version;
/** Increments whenever local sightings change; use as a memo dependency. */
export function useDbVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

// ---------------------------------------------------------------- row mapping
type Raw = Omit<LocalSighting, 'sensitive'> & { sensitive: number };

function fromRaw(r: Raw): LocalSighting {
  return { ...r, sensitive: !!r.sensitive };
}

export interface SightingFilter {
  year?: number | null;
  place?: string | null;
  speciesCode?: string | null;
}

function filterSql(f: SightingFilter | undefined, params: (string | number)[]): string {
  let sql = '';
  if (f?.year) {
    sql += ' and substr(observed_at, 1, 4) = ?';
    params.push(String(f.year));
  }
  if (f?.place) {
    sql += ' and place_name = ?';
    params.push(f.place);
  }
  if (f?.speciesCode) {
    sql += ' and species_code = ?';
    params.push(f.speciesCode);
  }
  return sql;
}

// ---------------------------------------------------------------- queries
export function listSightings(userId: string, filter?: SightingFilter): LocalSighting[] {
  const params: (string | number)[] = [userId];
  const where = filterSql(filter, params);
  return db.getAllSync<Raw>(`select * from sightings where user_id = ? and deleted = 0${where} order by observed_at desc`, params).map(fromRaw);
}

export function getSighting(id: string): LocalSighting | null {
  const r = db.getFirstSync<Raw>('select * from sightings where id = ? and deleted = 0', [id]);
  return r ? fromRaw(r) : null;
}

export interface LifeListEntry {
  species_code: string;
  first_seen: string;
  last_seen: string;
  sighting_count: number;
  photo: string | null; // local uri or storage path of the earliest photo
  first_sighting_id: string;
}

export function lifeList(userId: string, filter?: SightingFilter): LifeListEntry[] {
  const params: (string | number)[] = [userId];
  const where = filterSql(filter, params);
  // window functions pick the earliest sighting per species
  return db.getAllSync<LifeListEntry>(
    `with s as (
       select species_code, observed_at, id, coalesce(local_photo_uri, photo_path) as photo,
              row_number() over (partition by species_code order by observed_at asc) as rn,
              count(*) over (partition by species_code) as n,
              max(observed_at) over (partition by species_code) as last_seen,
              first_value(coalesce(local_photo_uri, photo_path)) over (
                partition by species_code order by (coalesce(local_photo_uri, photo_path) is null), observed_at) as any_photo
       from sightings where user_id = ? and deleted = 0${where})
     select species_code, observed_at as first_seen, last_seen, n as sighting_count, any_photo as photo, id as first_sighting_id
     from s where rn = 1 order by observed_at desc`,
    params,
  );
}

export function years(userId: string): number[] {
  return db
    .getAllSync<{ y: string }>('select distinct substr(observed_at, 1, 4) as y from sightings where user_id = ? and deleted = 0 order by y desc', [userId])
    .map((r) => Number(r.y));
}

export function places(userId: string): string[] {
  return db
    .getAllSync<{ p: string }>(
      "select place_name as p, count(*) as n from sightings where user_id = ? and deleted = 0 and place_name is not null and place_name <> '' group by place_name order by n desc, p",
      [userId],
    )
    .map((r) => r.p);
}

export function stats(userId: string): { sightings: number; species: number } {
  const r = db.getFirstSync<{ s: number; sp: number }>('select count(*) as s, count(distinct species_code) as sp from sightings where user_id = ? and deleted = 0', [userId]);
  return { sightings: r?.s ?? 0, species: r?.sp ?? 0 };
}

// ---------------------------------------------------------------- writes
export type SightingInput = Omit<LocalSighting, 'created_at' | 'updated_at' | 'dirty' | 'deleted'> & { created_at?: string; updated_at?: string };

export function saveSighting(input: SightingInput): LocalSighting {
  const now = new Date().toISOString();
  const existing = db.getFirstSync<Raw>('select * from sightings where id = ?', [input.id]);
  const row: LocalSighting = {
    ...input,
    created_at: existing?.created_at ?? input.created_at ?? now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  };
  upsertRow(row);
  notify();
  return row;
}

/** Insert or update many rows in one transaction without notifying per row (imports, pulls). */
export function saveMany(rows: LocalSighting[]) {
  db.withTransactionSync(() => rows.forEach(upsertRow));
  notify();
}

function upsertRow(row: LocalSighting) {
  db.runSync(
    `insert into sightings (id, user_id, species_code, observed_at, lat, lng, place_name, photo_path, local_photo_uri, note, visibility, sensitive, source, source_ref, created_at, updated_at, dirty, deleted)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (id) do update set
       species_code = excluded.species_code, observed_at = excluded.observed_at, lat = excluded.lat, lng = excluded.lng,
       place_name = excluded.place_name, photo_path = excluded.photo_path, local_photo_uri = excluded.local_photo_uri,
       note = excluded.note, visibility = excluded.visibility, sensitive = excluded.sensitive, source = excluded.source,
       source_ref = excluded.source_ref, updated_at = excluded.updated_at, dirty = excluded.dirty, deleted = excluded.deleted`,
    [
      row.id, row.user_id, row.species_code, row.observed_at, row.lat, row.lng, row.place_name, row.photo_path, row.local_photo_uri,
      row.note, row.visibility, row.sensitive ? 1 : 0, row.source, row.source_ref, row.created_at, row.updated_at, row.dirty, row.deleted,
    ],
  );
}

export function deleteSighting(id: string) {
  // Never pushed? Just drop it. Otherwise leave a tombstone for sync.
  const r = db.getFirstSync<{ dirty: number; created_at: string; updated_at: string }>('select dirty, created_at, updated_at from sightings where id = ?', [id]);
  if (!r) return;
  const neverSynced = r.dirty === 1 && !db.getFirstSync('select 1 from meta where key = ? ', [`synced:${id}`]);
  if (neverSynced) db.runSync('delete from sightings where id = ?', [id]);
  else db.runSync('update sightings set deleted = 1, dirty = 1, updated_at = ? where id = ?', [new Date().toISOString(), id]);
  notify();
}

/** Returns true if an import row would duplicate an existing one (species + day + ~100 m). */
export function hasDuplicate(userId: string, speciesCode: string, observedAt: string, lat: number | null, lng: number | null): boolean {
  const day = observedAt.slice(0, 10);
  const rows = db.getAllSync<{ lat: number | null; lng: number | null }>(
    'select lat, lng from sightings where user_id = ? and species_code = ? and substr(observed_at, 1, 10) = ? and deleted = 0',
    [userId, speciesCode, day],
  );
  return rows.some((r) => {
    if (lat == null || r.lat == null || lng == null || r.lng == null) return lat == null && r.lat == null;
    return Math.abs(r.lat - lat) < 0.001 && Math.abs(r.lng - lng) < 0.001;
  });
}

// ---------------------------------------------------------------- sync support
export function dirtyRows(userId: string): LocalSighting[] {
  return db.getAllSync<Raw>('select * from sightings where user_id = ? and dirty = 1', [userId]).map(fromRaw);
}

export function pendingCount(userId: string): number {
  return db.getFirstSync<{ n: number }>('select count(*) as n from sightings where user_id = ? and dirty = 1', [userId])?.n ?? 0;
}

export function markSynced(id: string, patch: { photo_path?: string | null } = {}) {
  db.withTransactionSync(() => {
    if (patch.photo_path !== undefined) db.runSync('update sightings set photo_path = ? where id = ?', [patch.photo_path, id]);
    db.runSync('update sightings set dirty = 0 where id = ?', [id]);
    db.runSync('insert or replace into meta (key, value) values (?, ?)', [`synced:${id}`, '1']);
  });
}

export function removeRow(id: string) {
  db.runSync('delete from sightings where id = ?', [id]);
  db.runSync('delete from meta where key = ?', [`synced:${id}`]);
}

/** Apply rows from the server. Local dirty rows win until they are pushed. */
export function applyServerRows(rows: Sighting[]) {
  db.withTransactionSync(() => {
    for (const s of rows) {
      const local = db.getFirstSync<{ dirty: number; local_photo_uri: string | null }>('select dirty, local_photo_uri from sightings where id = ?', [s.id]);
      if (local?.dirty) continue;
      upsertRow({ ...s, local_photo_uri: local?.local_photo_uri ?? null, dirty: 0, deleted: 0 });
      db.runSync('insert or replace into meta (key, value) values (?, ?)', [`synced:${s.id}`, '1']);
    }
  });
  notify();
}

/** Drop clean local rows the server no longer has (deleted from another device). */
export function pruneMissing(userId: string, serverIds: Set<string>) {
  const local = db.getAllSync<{ id: string }>('select id from sightings where user_id = ? and dirty = 0', [userId]);
  db.withTransactionSync(() => {
    for (const { id } of local) if (!serverIds.has(id)) removeRow(id);
  });
  notify();
}

export function getMeta(key: string): string | null {
  return db.getFirstSync<{ value: string }>('select value from meta where key = ?', [key])?.value ?? null;
}
export function setMeta(key: string, value: string) {
  db.runSync('insert or replace into meta (key, value) values (?, ?)', [key, value]);
}

export function clearLocalData() {
  db.execSync('delete from sightings; delete from meta;');
  notify();
}
