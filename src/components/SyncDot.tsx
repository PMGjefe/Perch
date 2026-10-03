// The word sync never appears in UI copy; say saved, backed up, online.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Platform, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useSyncState } from '@/components/SyncProvider';
import { useTheme } from '@/lib/theme';

const device = Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : 'phone';

/**
 * One quiet glyph in the diary masthead. Nothing at all when everything is in your account;
 * a breathing cloud while backing up; a still cloud when something is only on this device;
 * a warning when the last backup failed. Tap any of them to try again.
 */
export function SyncDot() {
  const { syncing, pending, lastError, sync } = useSyncState();
  const { colors } = useTheme();
  if (!syncing && !pending && !lastError) return null;

  const label = syncing ? 'Backing up' : pending > 0 ? `${pending} saved on this ${device}, not yet in your account` : 'Backup failed, tap to try again';

  return (
    <Pressable
      onPress={() => sync()}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: syncing }}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      {syncing ? (
        <Breathe>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.accent} />
        </Breathe>
      ) : pending > 0 ? (
        <Ionicons name="cloud-outline" size={20} color={colors.textMuted} />
      ) : (
        <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
      )}
    </Pressable>
  );
}

/** Slow opacity pulse while a backup is in flight; a steady 0.8 when motion is reduced. */
function Breathe({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 0.8 : 0.5);
  useEffect(() => {
    opacity.set(reduced ? 0.8 : withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [opacity, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}
