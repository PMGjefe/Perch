import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Photo } from '@/components/Photo';
import { Text } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, spacing, useTheme } from '@/lib/theme';

interface Props {
  sighting: { species_code: string; observed_at: string; photo_path: string | null; local_photo_uri?: string | null; dirty?: number | boolean | null };
  lifer?: boolean;
  last?: boolean;
  onPress: () => void;
}

const THUMB = 56;

/** A list row like the ones in Mail, Notes and Journal: square thumbnail, name, one quiet line, chevron. */
export function SightingRow({ sighting, lifer, last, onPress }: Props) {
  const { colors } = useTheme();
  const sp = speciesByCode(sighting.species_code);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : 'transparent', paddingLeft: spacing.md })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingRight: spacing.md }}>
        <Photo
          path={sighting.photo_path}
          localUri={sighting.local_photo_uri}
          style={{ width: THUMB, height: THUMB, borderRadius: 10 }}
          fallback={
            <View style={{ width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="leaf-outline" size={22} color={colors.textFaint} />
            </View>
          }
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="species" numberOfLines={1}>
            {sp?.common ?? sighting.species_code}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {formatTime(sighting.observed_at)}
            {sp?.family ? ` · ${sp.family}` : ''}
          </Text>
        </View>
        {lifer ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.accent }}>Lifer</Text>
        ) : null}
        {sighting.dirty ? <Ionicons name="cloud-upload-outline" size={16} color={colors.textFaint} /> : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
      {last ? null : <View style={{ height: 0.5, backgroundColor: colors.border, marginLeft: THUMB + spacing.md }} />}
    </Pressable>
  );
}
