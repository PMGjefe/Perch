import { exifDate, exifLocation, haversineM } from '@/lib/geo';

describe('haversineM', () => {
  it('measures Seattle to Portland roughly', () => {
    const d = haversineM({ lat: 47.6062, lng: -122.3321 }, { lat: 45.5152, lng: -122.6784 });
    expect(d).toBeGreaterThan(232_000);
    expect(d).toBeLessThan(236_000);
  });
  it('is zero for the same point', () => {
    expect(haversineM({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});

describe('exifLocation', () => {
  it('reads iOS-style numeric fields with hemisphere refs', () => {
    expect(exifLocation({ GPSLatitude: 47.66, GPSLatitudeRef: 'N', GPSLongitude: 122.33, GPSLongitudeRef: 'W' })).toEqual({ lat: 47.66, lng: -122.33 });
  });
  it('reads Android rational DMS strings', () => {
    const p = exifLocation({ GPSLatitude: '47/1,39/1,3600/100', GPSLatitudeRef: 'N', GPSLongitude: '122/1,19/1,4800/100', GPSLongitudeRef: 'W' });
    expect(p?.lat).toBeCloseTo(47.66, 3);
    expect(p?.lng).toBeCloseTo(-122.33, 3);
  });
  it('keeps already-signed southern/western values', () => {
    expect(exifLocation({ GPSLatitude: -33.9, GPSLatitudeRef: 'S', GPSLongitude: 151.2, GPSLongitudeRef: 'E' })).toEqual({ lat: -33.9, lng: 151.2 });
  });
  it('rejects missing, zero and out-of-range coordinates', () => {
    expect(exifLocation(null)).toBeNull();
    expect(exifLocation({ GPSLatitude: 0, GPSLongitude: 0 })).toBeNull();
    expect(exifLocation({ GPSLatitude: 95, GPSLongitude: 10 })).toBeNull();
    expect(exifLocation({ GPSLatitude: 'garbage', GPSLongitude: 10 })).toBeNull();
  });
});

describe('exifDate', () => {
  it('parses EXIF timestamps as local time', () => {
    const d = exifDate({ DateTimeOriginal: '2025:07:06 10:45:12' });
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2025, 6, 6, 10, 45]);
  });
  it('falls back through DateTimeDigitized and DateTime', () => {
    expect(exifDate({ DateTime: '2024:01:02 03:04:05' })?.getFullYear()).toBe(2024);
  });
  it('ignores malformed values', () => {
    expect(exifDate({ DateTimeOriginal: 'yesterday' })).toBeNull();
    expect(exifDate(undefined)).toBeNull();
  });
});
