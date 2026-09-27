import React, { useEffect, useState } from 'react';
import { type TextStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui';

/** Animates from the previous value to the new one; serif, big. */
export function CountUp({ value, style }: { value: number; style?: TextStyle }) {
  const progress = useSharedValue(value);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    progress.set(withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [value, progress]);
  useAnimatedReaction(
    () => Math.round(progress.get()),
    (v, prev) => {
      if (v !== prev) runOnJS(setShown)(v);
    },
  );
  return (
    <Animated.View>
      <Text variant="display" style={style}>
        {shown}
      </Text>
    </Animated.View>
  );
}
