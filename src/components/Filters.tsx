import React from 'react';
import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui';
import { spacing } from '@/lib/theme';

interface Props {
  years: number[];
  places: string[];
  year: number | null;
  place: string | null;
  onYear: (y: number | null) => void;
  onPlace: (p: string | null) => void;
  /** When given, a "With photos" chip toggles this. */
  withPhoto?: boolean;
  onWithPhoto?: (v: boolean) => void;
}

/** Year + place chip filters shared by life list and diary. */
export function Filters({ years, places, year, place, onYear, onPlace, withPhoto, onWithPhoto }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      {onWithPhoto ? <Chip label="With photos" icon="image-outline" active={!!withPhoto} onPress={() => onWithPhoto(!withPhoto)} /> : null}
      <Chip label="All time" active={year === null} onPress={() => onYear(null)} />
      {years.map((y) => (
        <Chip key={y} label={String(y)} active={year === y} onPress={() => onYear(year === y ? null : y)} />
      ))}
      {places.length ? <Chip label="Anywhere" icon="location-outline" active={place === null} onPress={() => onPlace(null)} /> : null}
      {places.slice(0, 12).map((p) => (
        <Chip key={p} label={p} active={place === p} onPress={() => onPlace(place === p ? null : p)} />
      ))}
    </ScrollView>
  );
}
