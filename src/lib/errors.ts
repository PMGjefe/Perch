/**
 * One place that turns whatever was thrown into words a person can act on.
 * Every error Alert in the app goes through `friendlyError`, so raw Postgres codes,
 * JWT complaints and "Network request failed" never reach the screen.
 */
import { Platform } from 'react-native';

/** What to call this thing in copy: "saved on this iPhone" reads better than "on this device". */
export const device = Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : 'phone';

/** The raw message of anything thrown: an Error, a Supabase-style `{ message }` object, or a plain value. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

// Ordered: the first pattern that matches wins, so the more specific causes sit above the vaguer ones.
const COPY: readonly (readonly [RegExp, string])[] = [
  [/network request failed|failed to fetch|network|offline|ECONN/i, 'You appear to be offline. Anything you log is safe on this phone and will reach your account later.'],
  [/jwt|token|expired|401|not authenticated/i, 'Please sign in again.'],
  [/row-level security|permission|42501|403/i, 'You do not have access to that.'],
  [/username/i, 'That username is taken.'],
  [/23505|duplicate|unique/i, 'That already exists.'],
  [/storage|bucket|payload too large|413/i, 'That photo could not be uploaded. Try a smaller one.'],
];

/**
 * Plain-words copy for an error. Known causes get a specific sentence; anything else gets
 * `fallback`, which call sites phrase for what the person was doing ("Could not save the list.").
 */
export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const msg = errorMessage(e);
  for (const [pattern, copy] of COPY) if (pattern.test(msg)) return copy;
  if (__DEV__) console.warn('[perch] unmapped error', msg);
  return fallback;
}
