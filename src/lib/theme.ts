import { useColorScheme } from 'react-native';

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
