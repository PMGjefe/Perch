import { useMemo } from 'react';

import * as db from '@/lib/db';

/** Re-runs a local SQLite query whenever local sightings change. */
export function useLocalQuery<T>(query: () => T, deps: unknown[]): T {
  const version = db.useDbVersion();
  const key = JSON.stringify(deps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => query(), [version, key]);
}

export function useLocalSightings(userId: string, filter?: db.SightingFilter) {
  return useLocalQuery(() => db.listSightings(userId, filter), [userId, filter?.year, filter?.place, filter?.speciesCode]);
}

export function useLocalSighting(id: string) {
  return useLocalQuery(() => db.getSighting(id), [id]);
}
