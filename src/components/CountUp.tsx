import React, { useEffect } from 'react';
import { TextInput, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts, useTheme } from '@/lib/theme';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedInput = Animated.createAnimatedComponent(TextInput);

/** Animates from the previous value to the new one entirely on the UI thread. Serif, big. */
export function CountUp({ value, style }: { value: number; style?: TextStyle }) {
  const { colors } = useTheme();
  const progress = useSharedValue(value);
  useEffect(() => {
    progress.set(withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [value, progress]);
  const props = useAnimatedProps(() => ({ text: String(Math.round(progress.get())), defaultValue: String(Math.round(progress.get())) }));
  return (
    <AnimatedInput
      editable={false}
      underlineColorAndroid="transparent"
      animatedProps={props}
      style={[{ fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -1, color: colors.text, padding: 0, margin: 0 }, style]}
    />
  );
}
