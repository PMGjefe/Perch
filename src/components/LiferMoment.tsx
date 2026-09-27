import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, spacing, useTheme } from '@/lib/theme';

export interface Lifer {
  species: string;
  scientific: string;
  number: number; // position on the life list
}

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  angle: (i / 22) * Math.PI * 2 + (i % 3) * 0.13,
  dist: 120 + (i % 5) * 34,
  size: 6 + (i % 4) * 3,
  delay: (i % 6) * 30,
}));

/**
 * Full-screen celebration when a species is new to the life list. Heavy haptic, a burst of
 * warm particles, the name set large in the serif. Tap anywhere to dismiss.
 */
export function LiferMoment({ lifer, onDone }: { lifer: Lifer | null; onDone: () => void }) {
  const { colors, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    if (lifer) haptic.celebrate();
  }, [lifer]);
  if (!lifer) return null;
  return (
    <Modal transparent animationType="none" visible onRequestClose={onDone} statusBarTranslucent>
      <Pressable onPress={onDone} style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={{ flex: 1 }}>
          <LinearGradient colors={dark ? ['#2A1D12', '#15130F'] : ['#F6E3D0', '#F7F1E8']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            <View style={{ position: 'absolute', left: width / 2, top: height / 2 - 60 }}>
              {PARTICLES.map((p, i) => (
                <Particle key={i} {...p} color={i % 3 === 0 ? colors.accent : i % 3 === 1 ? colors.accentSoft : colors.success} />
              ))}
            </View>
            <Animated.View entering={ZoomIn.delay(80).springify().damping(14).stiffness(180)} style={{ alignItems: 'center', gap: spacing.md }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 3, color: colors.accent }}>LIFER</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 96, lineHeight: 100, letterSpacing: -3, color: colors.text }}>#{lifer.number}</Text>
              <Text variant="title" style={{ textAlign: 'center' }}>
                {lifer.species}
              </Text>
              <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: colors.textMuted, textAlign: 'center' }}>{lifer.scientific}</Text>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(900)} style={{ position: 'absolute', bottom: 64 }}>
              <Text variant="caption" muted>
                Tap anywhere
              </Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Particle({ angle, dist, size, delay, color }: { angle: number; dist: number; size: number; delay: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withSequence(withSpring(1, { damping: 12, stiffness: 90 }), withTiming(1.15, { duration: 900, easing: Easing.out(Easing.quad) }))));
  }, [t, delay]);
  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      transform: [{ translateX: Math.cos(angle) * dist * v }, { translateY: Math.sin(angle) * dist * v + 40 * Math.max(0, v - 1) * 6 }, { scale: 1.2 - v * 0.5 }],
      opacity: v < 1 ? 1 : Math.max(0, 1 - (v - 1) * 6),
    };
  });
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}
