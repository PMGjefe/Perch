import { sizedUri } from '@/lib/imageSize';
import { posterFor, posterGradients } from '@/lib/theme';

// theme.ts re-exports the app fonts; expo-font pulls in native asset loading that jest cannot resolve.
jest.mock('@/lib/fonts', () => ({ fonts: {} }));

const FAMILIES: (string | undefined)[] = [
  'Parulidae (New World Warblers)',
  'Turdidae (Thrushes and Allies)',
  'Corvidae (Crows, Jays, and Magpies)',
  'Trochilidae (Hummingbirds)',
  'Accipitridae (Hawks, Eagles, and Kites)',
  'Anatidae (Ducks, Geese, and Waterfowl)',
  '',
  undefined,
];

describe('posterGradients', () => {
  it('has six pairs per scheme', () => {
    expect(posterGradients.light).toHaveLength(6);
    expect(posterGradients.dark).toHaveLength(6);
    for (const pair of [...posterGradients.light, ...posterGradients.dark]) expect(pair).toHaveLength(2);
  });
});

describe('posterFor', () => {
  it('gives every bird in a family the same pair', () => {
    for (const family of FAMILIES) {
      expect(posterFor(family, false)).toBe(posterFor(family, false));
      expect(posterFor(family, true)).toBe(posterFor(family, true));
    }
  });

  it('always lands on one of the six pairs', () => {
    const slot = (set: readonly (readonly [string, string])[], pair: readonly [string, string]) => set.indexOf(pair);
    for (const family of FAMILIES) {
      const light = slot(posterGradients.light, posterFor(family, false));
      const dark = slot(posterGradients.dark, posterFor(family, true));
      expect(light).toBeGreaterThanOrEqual(0);
      expect(light).toBeLessThan(6);
      expect(dark).toBeGreaterThanOrEqual(0);
      expect(dark).toBeLessThan(6);
      expect(light).toBe(dark); // same slot in both schemes
    }
  });

  it('hashes by the sum of char codes', () => {
    expect(posterFor('A', false)).toBe(posterGradients.light[65 % 6]);
    expect(posterFor('AB', false)).toBe(posterGradients.light[(65 + 66) % 6]);
  });

  it('falls back to the first pair for an unknown family', () => {
    expect(posterFor(undefined, false)).toBe(posterGradients.light[0]);
    expect(posterFor(undefined, true)).toBe(posterGradients.dark[0]);
    expect(posterFor('', false)).toBe(posterGradients.light[0]);
  });

  it('uses a different pair in dark mode', () => {
    for (const family of FAMILIES) expect(posterFor(family, true)).not.toEqual(posterFor(family, false));
  });
});


describe('sizedUri', () => {
  it('asks Unsplash for a smaller image and leaves other URLs alone', () => {
    expect(sizedUri('https://images.unsplash.com/photo-1?w=1080&q=80')).toBe('https://images.unsplash.com/photo-1?w=720&q=80');
    expect(sizedUri('https://x.supabase.co/storage/v1/sign/a.jpg?token=1')).toBe('https://x.supabase.co/storage/v1/sign/a.jpg?token=1');
  });
});
