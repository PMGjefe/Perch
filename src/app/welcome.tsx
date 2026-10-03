import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Row, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/lib/theme';
import { DEFAULT_USERNAME } from '@/lib/validation';

/** First name from the profile when it has a real one; 'birder' for a blank, an email or a generated handle. */
function firstName(displayName: string | null | undefined): string {
  const first = (displayName ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first || first.includes('@') || DEFAULT_USERNAME.test(first)) return 'birder';
  return first;
}

const POINTS = [
  { icon: 'book-outline', text: 'Your diary, grouped by outing' },
  { icon: 'list-outline', text: 'A life list that builds itself' },
  { icon: 'lock-closed-outline', text: 'Private near home. Share only what you choose.' },
] as const;

/**
 * Hello, birder: one static welcome for a new account. Ends in the species picker. The gate has
 * already recorded the visit, so every exit path just leaves.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, dark } = useTheme();
  const { profile } = useAuth();
  const reduced = useReducedMotion();
  const first = firstName(profile?.display_name);

  const enter = (i: number) => (reduced ? undefined : FadeInDown.delay(i * 80).springify().damping(18).stiffness(200));

  const logFirstBird = () => {
    router.back();
    router.navigate({ pathname: '/(tabs)/log', params: { pick: '1' } });
  };
  const lookAround = () => router.back();
  const bringImport = () => {
    router.back();
    router.push('/settings/import');
  };

  return (
    <LinearGradient colors={dark ? ['#2A1D12', '#15130F'] : ['#F6E3D0', '#F7F1E8']} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl, justifyContent: 'space-between' }}>
        <Animated.View entering={enter(0)} style={{ gap: spacing.md }}>
          <Ionicons name="leaf" size={40} color={colors.accent} />
          <Text variant="display" accessibilityRole="header">
            Hello, {first}.
          </Text>
          <Text muted style={{ fontSize: 17, lineHeight: 24 }}>
            Perch is your bird diary. Log what you see and it becomes your life list, your map and your year.
          </Text>
        </Animated.View>

        <Animated.View entering={enter(1)} style={{ gap: spacing.lg }}>
          {POINTS.map((p) => (
            <Row key={p.icon} gap={spacing.md}>
              <Ionicons name={p.icon} size={22} color={colors.accent} />
              <Text style={{ flex: 1 }}>{p.text}</Text>
            </Row>
          ))}
        </Animated.View>

        <Animated.View entering={enter(2)} style={{ gap: spacing.sm }}>
          <Button title="Log my first bird" icon="add" onPress={logFirstBird} />
          <Button kind="ghost" title="Look around first" onPress={lookAround} />
          <Pressable accessibilityRole="link" onPress={bringImport} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'center', paddingVertical: spacing.sm, opacity: pressed ? 0.6 : 1 })}>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              Have an eBird export? Bring it over.
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}
