// Push local changes to Supabase and pull the server copy back. Safe to call often.
import { File } from 'expo-file-system';
import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import * as db from '@/lib/db';
import { PHOTO_BUCKET, supabase } from '@/lib/supabase';
import type { Sighting } from '@/types/db';

let inFlight: Promise<SyncResult> | null = null;

// Sync status lives outside React so screens can subscribe without effects that set state.
interface SyncStatus {
  syncing: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
}
let status: SyncStatus = { syncing: false, lastError: null, lastSyncAt: null };
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}
const subscribeStatus = (l: () => void) => {
  statusListeners.add(l);
  return () => {
    statusListeners.delete(l);
  };
};
const getStatus = () => status;

export interface SyncResult {
  pushed: number;
  pulled: number;
  skipped: boolean;
  error?: string;
}

export async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return !!s.isConnected && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export function syncNow(userId: string): Promise<SyncResult> {
  if (inFlight) return inFlight;
  setStatus({ syncing: true });
  inFlight = run(userId)
    .then((r) => {
      setStatus({ syncing: false, lastError: r.error ?? null, lastSyncAt: r.skipped || r.error ? status.lastSyncAt : new Date().toISOString() });
      return r;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

async function run(userId: string): Promise<SyncResult> {
  if (!(await isOnline())) return { pushed: 0, pulled: 0, skipped: true };
  let pushed = 0;
  let pulled = 0;
  try {
    // ---- push
    for (const row of db.dirtyRows(userId)) {
      if (row.deleted) {
        const { error } = await supabase.from('sightings').delete().eq('id', row.id);
        if (error) throw error;
        if (row.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([row.photo_path]);
        db.removeRow(row.id);
        pushed++;
        continue;
      }
      let photoPath = row.photo_path;
      if (row.local_photo_uri && !photoPath) {
        photoPath = await uploadPhoto(userId, row.id, row.local_photo_uri);
      }
      const payload: Omit<Sighting, 'created_at'> & { created_at: string } = {
        id: row.id,
        user_id: userId,
        species_code: row.species_code,
        observed_at: row.observed_at,
        lat: row.lat,
        lng: row.lng,
        place_name: row.place_name,
        photo_path: photoPath,
        note: row.note,
        visibility: row.visibility,
        sensitive: row.sensitive,
        source: row.source,
        source_ref: row.source_ref,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      const { error } = await supabase.from('sightings').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      db.markSynced(row.id, { photo_path: photoPath });
      pushed++;
    }

    // ---- pull (everything since last pull, plus an id sweep for deletions)
    const since = db.getMeta(`last_pull:${userId}`);
    let q = supabase.from('sightings').select('*').eq('user_id', userId).order('updated_at', { ascending: true }).limit(2000);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Sighting[];
    if (rows.length) {
      db.applyServerRows(rows);
      db.setMeta(`last_pull:${userId}`, rows[rows.length - 1].updated_at);
      pulled = rows.length;
    }
    const { data: ids, error: idErr } = await supabase.from('sightings').select('id').eq('user_id', userId);
    if (idErr) throw idErr;
    db.pruneMissing(userId, new Set((ids ?? []).map((r: { id: string }) => r.id)));
    db.setMeta(`last_sync_at:${userId}`, new Date().toISOString());
    return { pushed, pulled, skipped: false };
  } catch (e) {
    return { pushed, pulled, skipped: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function uploadPhoto(userId: string, sightingId: string, uri: string): Promise<string> {
  const path = `${userId}/${sightingId}.jpg`;
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

/** Keeps the local store in sync: on mount, on foreground, on reconnect, and after local writes. */
export function useSync(userId: string | null) {
  const { syncing, lastError, lastSyncAt } = useSyncExternalStore(subscribeStatus, getStatus, getStatus);
  const version = db.useDbVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the change signal for the local store
  const pending = useMemo(() => (userId ? db.pendingCount(userId) : 0), [userId, version]);

  const sync = useCallback(() => (userId ? syncNow(userId) : Promise.resolve(null)), [userId]);

  useEffect(() => {
    sync();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    const net = Network.addNetworkStateListener((s) => {
      if (s.isConnected) sync();
    });
    return () => {
      app.remove();
      net.remove();
    };
  }, [sync]);

  // Debounced sync after any local write.
  useEffect(() => {
    if (version === 0) return;
    const t = setTimeout(sync, 800);
    return () => clearTimeout(t);
  }, [version, sync]);

  return { syncing, pending, lastError, lastSyncAt, sync };
}
