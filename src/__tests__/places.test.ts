import { haversineM, nearestPlace } from '@/lib/geo';

// One degree of latitude is ~111 km, so 0.0009° ≈ 100 m and 0.00225° ≈ 250 m.
const here = { lat: 47.6, lng: -122.3 };
const at100m = { lat: 47.6009, lng: -122.3 };
const at250m = { lat: 47.60225, lng: -122.3 };
const at550m = { lat: 47.605, lng: -122.3 };

describe('nearestPlace', () => {
  it('uses distances that match the test setup', () => {
    expect(haversineM(here, at100m)).toBeCloseTo(100, -1);
    expect(haversineM(here, at250m)).toBeCloseTo(250, -1);
    expect(haversineM(here, at550m)).toBeGreaterThan(300);
  });

  it('picks the nearest patch within the radius, whatever the list order', () => {
    const anchors = [
      { place: 'Far meadow', ...at250m, n: 12 },
      { place: 'Near pond', ...at100m, n: 1 },
    ];
    expect(nearestPlace(anchors, here)).toBe('Near pond');
  });

  it('returns null when every patch is outside the radius', () => {
    const anchors = [
      { place: 'Across town', ...at550m, n: 20 },
      { place: 'Other side', lat: 47.6, lng: -122.31, n: 3 },
    ];
    expect(nearestPlace(anchors, here)).toBeNull();
    expect(nearestPlace([], here)).toBeNull();
  });

  it('breaks an exact tie by the better-known patch', () => {
    const anchors = [
      { place: 'Backyard (old name)', ...at100m, n: 2 },
      { place: 'Backyard', ...at100m, n: 9 },
    ];
    expect(nearestPlace(anchors, here)).toBe('Backyard');
    expect(nearestPlace([...anchors].reverse(), here)).toBe('Backyard');
  });

  it('honours a custom radius', () => {
    const anchors = [{ place: 'Far meadow', ...at250m, n: 1 }];
    expect(nearestPlace(anchors, here, 200)).toBeNull();
    expect(nearestPlace(anchors, here, 600)).toBe('Far meadow');
  });
});
