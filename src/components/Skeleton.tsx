import React, { useEffect } from 'react';
import { type DimensionValue, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { radius, spacing, useTheme } from '@/lib/theme';

/** Pulsing placeholder block. Holds still at a mid opacity when Reduce Motion is on. */
export function Skeleton({ width = '100%', height = 16, round = radius.sm, style }: { width?: DimensionValue; height?: number; round?: number; style?: object }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    if (reduced) opacity.set(0.7);
    else opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[{ width, height, borderRadius: round, backgroundColor: colors.surfaceAlt }, animated, style]} />;
}

/** Three feed-card shaped skeletons. */
export function FeedSkeleton() {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <Skeleton height={260} round={radius.lg} />
          <Skeleton width="55%" height={20} />
          <Skeleton width="35%" height={12} />
        </View>
      ))}
    </View>
  );
}
