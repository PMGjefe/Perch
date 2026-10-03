import React, { useMemo } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { DARK_MAP } from '@/lib/mapStyle';

import { Empty } from '@/components/ui';
import { speciesName } from '@/lib/taxonomy';
import { useTheme } from '@/lib/theme';
import type { PublicSighting, Sighting } from '@/types/db';

type Pin = (Sighting | PublicSighting) & { location_fuzzed?: boolean };

/** Map of sightings. Fuzzed pins render as circles; sensitive/hidden ones have no coords and are skipped. */
export function SightingsMap({ sightings, onPress, fuzzPreview, showUser = true }: { sightings: Pin[]; onPress?: (id: string) => void; fuzzPreview?: (s: Pin) => boolean; showUser?: boolean }) {
  const { colors, dark } = useTheme();
  const pins = useMemo(() => sightings.filter((s) => s.lat != null && s.lng != null), [sightings]);

  const region = useMemo(() => {
    if (!pins.length) return { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 };
    const lats = pins.map((p) => p.lat!);
    const lngs = pins.map((p) => p.lng!);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.4),
    };
  }, [pins]);

  if (!pins.length) {
    return (
      <View style={{ flex: 1 }}>
        <Empty icon="map-outline" title="No pins yet" body="Sightings with a location show up here." />
      </View>
    );
  }

  return (
    <MapView style={{ flex: 1 }} initialRegion={region} showsUserLocation={showUser} userInterfaceStyle={dark ? 'dark' : 'light'} customMapStyle={dark ? DARK_MAP : undefined}>
      {pins.map((s) => {
        const fuzzed = s.location_fuzzed || fuzzPreview?.(s);
        if (fuzzed) {
          return <Circle key={s.id} center={{ latitude: s.lat!, longitude: s.lng! }} radius={600} fillColor={colors.accent + '22'} strokeColor={colors.accent} strokeWidth={1} />;
        }
        return (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            title={speciesName(s.species_code)}
            description={s.place_name ?? undefined}
            pinColor={s.sensitive ? colors.textFaint : colors.accent}
            onCalloutPress={() => onPress?.(s.id)}
          />
        );
      })}
    </MapView>
  );
}
