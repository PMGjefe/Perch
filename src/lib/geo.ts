import * as Location from 'expo-location';

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatCoords(p: LatLng): string {
  return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
}

/** Ask for foreground location permission and return the current position, or null. */
export async function getCurrentLocation(): Promise<LatLng | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** True when the user has explicitly denied location and the system will not ask again. */
export async function locationPermissionDenied(): Promise<boolean> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    return p.status === 'denied' && !p.canAskAgain;
  } catch {
    return false;
  }
}

/** Current position only if permission was already granted; never prompts. */
export async function getLocationIfGranted(): Promise<LatLng | null> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    if (p.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** Best-effort short place name (park, neighbourhood, town). Returns null offline. */
export async function reverseGeocode(p: LatLng): Promise<string | null> {
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
    if (!r) return null;
    return r.name && !/^\d/.test(r.name) ? r.name : r.district || r.subregion || r.city || r.region || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- EXIF
// iOS flattens {GPS} into GPSLatitude (number) + GPSLatitudeRef; Android gives
// ExifInterface strings like "47/1,39/1,4512/100" + GPSLatitudeRef.
function rationalToNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const parts = v.split(',').map((part) => {
    const [n, d] = part.split('/').map(Number);
    return d ? n / d : n;
  });
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 1) return parts[0];
  const [deg = 0, min = 0, sec = 0] = parts;
  return deg + min / 60 + sec / 3600;
}

export function exifLocation(exif: Record<string, unknown> | null | undefined): LatLng | null {
  if (!exif) return null;
  const lat = rationalToNumber(exif.GPSLatitude);
  const lng = rationalToNumber(exif.GPSLongitude);
  if (lat == null || lng == null) return null;
  const latRef = String(exif.GPSLatitudeRef ?? 'N');
  const lngRef = String(exif.GPSLongitudeRef ?? 'E');
  const signedLat = latRef.toUpperCase().startsWith('S') && lat > 0 ? -lat : lat;
  const signedLng = lngRef.toUpperCase().startsWith('W') && lng > 0 ? -lng : lng;
  if (Math.abs(signedLat) > 90 || Math.abs(signedLng) > 180 || (signedLat === 0 && signedLng === 0)) return null;
  return { lat: signedLat, lng: signedLng };
}

export function exifDate(exif: Record<string, unknown> | null | undefined): Date | null {
  if (!exif) return null;
  const raw = exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.DateTime;
  if (typeof raw !== 'string') return null;
  // "2025:07:06 10:45:12" -> local time
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------- places
/**
 * The user's own patch that `p` falls inside: the nearest anchor within `maxM` metres.
 * Equal distances go to the better-known patch (larger n). Null when nothing is close.
 */
export function nearestPlace(anchors: { place: string; lat: number; lng: number; n: number }[], p: LatLng, maxM = 300): string | null {
  let best: { place: string; d: number; n: number } | null = null;
  for (const a of anchors) {
    const d = haversineM(a, p);
    if (d > maxM) continue;
    if (!best || d < best.d || (d === best.d && a.n > best.n)) best = { place: a.place, d, n: a.n };
  }
  return best?.place ?? null;
}
