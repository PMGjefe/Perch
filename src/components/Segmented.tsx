import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/lib/theme';

/** The iOS two-or-three-way segmented control: one rounded track, the selected segment raised. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 9, padding: 2 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) {
                haptic.select();
                onChange(o.value);
              }
            }}
            style={{ paddingHorizontal: 14, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.surface : 'transparent' }}
          >
            <Text variant="label" muted={!active} style={{ fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
