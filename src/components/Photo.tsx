import { Image, type ImageProps } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

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
  const reduced = useReducedMotion();
  const signed = usePhotoUrl(localUri ? null : path);
  const uri = localUri ?? signed;
  if (!path && !localUri) return <>{fallback ?? null}</>;
  if (!uri) return <View style={[{ backgroundColor: colors.surfaceAlt }, style]} />;
  // The cross-fade is skipped under Reduce Motion; callers can still override via rest.
  return <Image source={{ uri }} style={[{ backgroundColor: colors.surfaceAlt }, style]} contentFit="cover" transition={reduced ? 0 : 150} {...rest} />;
}
