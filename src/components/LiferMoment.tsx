import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Photo } from '@/components/Photo';
import { Button, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';

export interface Lifer {
  species: string;
  scientific: string;
  number: number; // position on the life list
  /** The sighting's photo, if any: the local file right after logging, or the storage path. */
  photoLocalUri?: string | null;
  photoPath?: string | null;
}

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  angle: (i / 22) * Math.PI * 2 + (i % 3) * 0.13,
  dist: 120 + (i % 5) * 34,
  size: 6 + (i % 4) * 3,
  delay: (i % 6) * 30,
}));

// The scrim over a blurred photo. Fixed tints of the two palettes' bg colours; everything else comes from the theme.
const SCRIM_DARK = 'rgba(21,19,15,0.74)';
const SCRIM_LIGHT = 'rgba(247,241,232,0.80)';

/**
 * Full-screen celebration when a species is new to the life list. Heavy haptic, a burst of
 * warm particles, the name set large in the serif, the sighting's own photo as a blurred backdrop.
 * Tap anywhere, or the button, to dismiss.
 */
export function LiferMoment({ lifer, onDone }: { lifer: Lifer | null; onDone: () => void }) {
  const { colors, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  useEffect(() => {
    // Haptics are not motion: the thump still lands with Reduce Motion on.
    if (lifer) haptic.celebrate();
  }, [lifer]);
  if (!lifer) return null;

  const first = lifer.number === 1;
  const hasPhoto = !!(lifer.photoLocalUri || lifer.photoPath);
  const textIn = reduced ? FadeIn : ZoomIn.delay(80).springify().damping(14).stiffness(180);
  const tileIn = reduced ? FadeIn : ZoomIn.delay(40).springify().damping(14).stiffness(180);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDone} statusBarTranslucent accessibilityViewIsModal>
      <Pressable onPress={onDone} style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1 }}>
          {hasPhoto ? (
            <>
              <Photo path={lifer.photoPath} localUri={lifer.photoLocalUri} blurRadius={24} contentFit="cover" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? SCRIM_DARK : SCRIM_LIGHT }]} />
            </>
          ) : (
            <LinearGradient colors={dark ? ['#2A1D12', '#15130F'] : ['#F6E3D0', '#F7F1E8']} style={StyleSheet.absoluteFill} />
          )}

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
            {reduced ? null : (
              <View style={{ position: 'absolute', left: width / 2, top: height / 2 - 60 }}>
                {PARTICLES.map((p, i) => (
                  <Particle key={i} {...p} color={i % 3 === 0 ? colors.accent : i % 3 === 1 ? colors.accentSoft : colors.success} />
                ))}
              </View>
            )}

            {hasPhoto ? (
              <Animated.View entering={tileIn}>
                <Photo
                  path={lifer.photoPath}
                  localUri={lifer.photoLocalUri}
                  accessible={false}
                  style={{ width: 132, height: 132, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
                />
              </Animated.View>
            ) : null}

            <Animated.View
              entering={textIn}
              accessible
              accessibilityLabel={first ? `Your first bird, ${lifer.species}` : `Lifer number ${lifer.number}, ${lifer.species}`}
              style={{ alignItems: 'center', gap: spacing.md }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 3, color: colors.accent }}>{first ? 'YOUR FIRST BIRD' : 'LIFER'}</Text>
              {first ? null : <Text style={{ fontFamily: fonts.display, fontSize: 96, lineHeight: 100, letterSpacing: -3, color: colors.text }}>#{lifer.number}</Text>}
              <Text variant={first ? 'display' : 'title'} style={{ textAlign: 'center' }}>
                {lifer.species}
              </Text>
              <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: colors.textMuted, textAlign: 'center' }}>{lifer.scientific}</Text>
              {first ? (
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: colors.text, textAlign: 'center' }}>The list starts here.</Text>
              ) : (
                <Text variant="caption" muted style={{ textAlign: 'center' }}>
                  New to your life list.
                </Text>
              )}
            </Animated.View>
          </View>

          <Animated.View entering={FadeIn.delay(700)} style={{ position: 'absolute', bottom: insets.bottom + spacing.xl, left: spacing.xl, right: spacing.xl, gap: spacing.sm }}>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              Tap anywhere to continue
            </Text>
            <Button title="Keep going" onPress={onDone} />
          </Animated.View>
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
