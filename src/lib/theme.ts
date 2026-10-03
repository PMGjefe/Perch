import { useColorScheme } from 'react-native';

export { fonts } from '@/lib/fonts';

// Warm, photo-forward palette. Light is cream + terracotta; dark is charcoal + ember.
export const palettes = {
  light: {
    bg: '#F7F1E8',
    surface: '#FFFCF7',
    surfaceAlt: '#EFE6D8',
    border: '#E2D6C3',
    text: '#22201C',
    textMuted: '#6F675C',
    textFaint: '#A39A8C',
    accent: '#C4622D',
    accentSoft: '#F4DCCB',
    onAccent: '#FFFFFF',
    danger: '#B23A3A',
    success: '#3F7D4E',
    overlay: 'rgba(34,32,28,0.55)',
    tabBar: '#FFFCF7',
  },
  dark: {
    bg: '#15130F',
    surface: '#1F1C17',
    surfaceAlt: '#2A2620',
    border: '#3A342B',
    text: '#F2ECE2',
    textMuted: '#B3A897',
    textFaint: '#7A7264',
    accent: '#E07A45',
    accentSoft: '#3E2A1E',
    onAccent: '#15130F',
    danger: '#E06A6A',
    success: '#7DBB8C',
    overlay: 'rgba(0,0,0,0.6)',
    tabBar: '#1F1C17',
  },
};

export type Palette = typeof palettes.light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export function useTheme() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { colors: dark ? palettes.dark : palettes.light, dark, spacing, radius };
}

// Poster gradients for sightings without a photo: six warm pairs per scheme. The bird's family
// picks the pair, so every warbler shares a hue and a photo-less diary still has rhythm.
export const posterGradients = {
  light: [
    ['#F1D9C4', '#E6C7A8'],
    ['#E9D8C9', '#D9BFA7'],
    ['#F4DCCB', '#E7C3AE'],
    ['#E8DFCB', '#D6C7A6'],
    ['#EEDAD2', '#DDBEB4'],
    ['#E6DCCD', '#CDBBA3'],
  ],
  dark: [
    ['#3A2A1E', '#1F1C17'],
    ['#33281F', '#1F1C17'],
    ['#3E2A1E', '#1F1C17'],
    ['#2E2A1C', '#1F1C17'],
    ['#3A2622', '#1F1C17'],
    ['#2C2822', '#1F1C17'],
  ],
} as const;

/** The poster pair for a family: index = sum of its char codes mod six, so the same family always gets the same hue. Unknown family → the first pair. */
export function posterFor(family: string | undefined, dark: boolean): readonly [string, string] {
  const key = family ?? '';
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  const set = dark ? posterGradients.dark : posterGradients.light;
  return set[sum % set.length];
}
