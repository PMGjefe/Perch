import { Image, type ImageProps } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { usePhotoUrl } from '@/lib/photos';
import { useTheme } from '@/lib/theme';

interface Props extends Omit<ImageProps, 'source'> {
  /** Storage path, absolute URL, or null. */
  path: string | null | undefined;
  /** A not-yet-uploaded local file takes precedence. */
  localUri?: string | null;
  /** Rendered when there is no photo at all (not while a signed URL is loading). */
  fallback?: React.ReactNode;
}

/** Renders a sighting photo from a private-bucket path via a signed URL, a local file, or a direct URL. */
export function Photo({ path, localUri, fallback, style, ...rest }: Props) {
  const { colors } = useTheme();
  const signed = usePhotoUrl(localUri ? null : path);
  const uri = localUri ?? signed;
  if (!path && !localUri) return <>{fallback ?? null}</>;
  if (!uri) return <View style={[{ backgroundColor: colors.surfaceAlt }, style]} />;
  return <Image source={{ uri }} style={[{ backgroundColor: colors.surfaceAlt }, style]} contentFit="cover" transition={150} {...rest} />;
}

/** Warm placeholder block with the species initials, used where a sighting has no photo. */
export function PhotoPlaceholder({ label, height, fontSize = 40 }: { label: string; height: number; fontSize?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '100%', height, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize, color: colors.accent, fontWeight: '700', opacity: 0.8 }}>{label}</Text>
    </View>
  );
}
