import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

/** Big serif value over a small muted label. */
export function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text variant="heading">{value}</Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}
