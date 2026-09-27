import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Spring config shared by presses and layout moves: quick, slightly bouncy, never floaty. */
export const spring = { damping: 18, stiffness: 260, mass: 0.6 } as const;

/** Reanimated layout transition for lists whose rows move (filters, reorders, deletes). */
export const layout = LinearTransition.springify().damping(20).stiffness(220);

interface TapProps extends PressableProps {
  /** Scale while pressed; 0.97 for cards, 0.9 for icons. */
  scaleTo?: number;
  /** Haptic on press-in. Defaults to a light tap. */
  feedback?: keyof typeof haptic | null;
  style?: StyleProp<ViewStyle>;
}

/** Pressable that squashes with a spring and gives a light haptic. Use for cards, chips and buttons. */
export function Tap({ scaleTo = 0.97, feedback = 'tap', style, onPressIn, onPressOut, children, ...rest }: TapProps) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        if (!reduced) scale.set(withSpring(scaleTo, spring));
        if (feedback) haptic[feedback]();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, spring));
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Fades and rises in; pass `index` to stagger a list. */
export function Rise({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(Math.min(index, 8) * 45).springify().damping(18).stiffness(200)} layout={layout} style={style}>
      {children}
    </Animated.View>
  );
}
