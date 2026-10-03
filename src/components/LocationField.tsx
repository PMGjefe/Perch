import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Linking, Modal, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, IconButton, Input, Row, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { DARK_MAP } from '@/lib/mapStyle';
import { formatCoords, getCurrentLocation, type LatLng, locationPermissionDenied, nearestPlace, reverseGeocode } from '@/lib/geo';
import { spacing, useTheme } from '@/lib/theme';

interface Props {
  value: LatLng | null;
  placeName: string;
  onChange: (p: LatLng | null) => void;
  onPlaceNameChange: (s: string) => void;
  status?: string | null;
  /** Hide the place-name input (e.g. picking a home location). */
  hidePlaceName?: boolean;
  label?: string;
}

export function LocationField({ value, placeName, onChange, onPlaceNameChange, status, hidePlaceName, label = 'Where' }: Props) {
  const { colors, dark } = useTheme();
  const { profile } = useAuth();
  const userId = useUserId();
  const home = profile?.home_lat != null && profile.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : null;
  // The user's own patches: named spots from past sightings, so a pin can name itself without the network.
  const anchors = useLocalQuery(() => db.placeAnchors(userId), [userId]);
  const recentPlaces = useLocalQuery(() => db.places(userId), [userId]);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const trimmedPlace = placeName.trim();
  const near = value ? nearestPlace(anchors, value) : null;
  // Only while the name is blank: the patch the pin sits in first, then the usual haunts.
  const suggestions = !hidePlaceName && !trimmedPlace ? [near, ...recentPlaces.filter((p) => p !== near)].filter((p): p is string => !!p).slice(0, 4) : [];

  const useCurrent = async () => {
    setLocating(true);
    const p = await getCurrentLocation();
    setLocating(false);
    if (!p) {
      if (await locationPermissionDenied()) {
        Alert.alert('Location is off', 'Allow location access in Settings to drop the pin where you are.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      }
      return;
    }
    onChange(p);
    if (!placeName && !hidePlaceName) {
      // A known patch names itself, even offline; otherwise ask the geocoder.
      const known = nearestPlace(anchors, p);
      if (known) onPlaceNameChange(known);
      else {
        const name = await reverseGeocode(p);
        if (name) onPlaceNameChange(name);
      }
    }
  };

  const caption = hidePlaceName
    ? value
      ? 'Pinned on the map'
      : (status ?? 'No pin yet')
    : value
      ? trimmedPlace
        ? `${trimmedPlace} · pinned`
        : 'Pinned on the map'
      : (status ?? 'Add a pin and this bird lands on your map.');

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" muted>
        {label}
      </Text>
      {hidePlaceName ? null : <Input value={placeName} onChangeText={onPlaceNameChange} placeholder="Place name (park, patch, backyard)" />}
      {suggestions.length ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" faint>
            Your places
          </Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {suggestions.map((p) => (
              <Chip key={p} label={p} icon={p === near ? 'location' : undefined} onPress={() => onPlaceNameChange(p)} />
            ))}
          </Row>
        </View>
      ) : null}
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label={locating ? 'Locating…' : 'Current location'} icon="locate" onPress={useCurrent} active={!!value && !locating} />
        <Chip label={value ? 'Adjust on map' : 'Pick on map'} icon="map-outline" onPress={() => setMapOpen(true)} />
        {value ? <Chip label="Clear" icon="close" onPress={() => onChange(null)} /> : null}
      </Row>
      <Row gap={6}>
        <Ionicons name="location" size={14} color={value ? colors.accent : colors.textFaint} />
        <Text variant="caption" muted style={{ flexShrink: 1 }}>
          {caption}
        </Text>
      </Row>
      <MapPickerModal
        visible={mapOpen}
        initial={value}
        fallbackAnchor={anchors[0] ? { lat: anchors[0].lat, lng: anchors[0].lng } : null}
        fallback={home}
        dark={dark}
        onClose={() => setMapOpen(false)}
        onPick={onChange}
        colors={colors}
      />
    </View>
  );
}

function MapPickerModal({
  visible,
  initial,
  fallbackAnchor,
  fallback,
  dark,
  onClose,
  onPick,
  colors,
}: {
  visible: boolean;
  initial: LatLng | null;
  /** The user's best-known patch, for a sensible starting view when there is no pin yet. */
  fallbackAnchor: LatLng | null;
  fallback: LatLng | null;
  dark: boolean;
  onClose: () => void;
  onPick: (p: LatLng) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<LatLng | null>(initial);
  // Open on the pin, else the user's best-known patch, else home, else the whole world.
  const start = initial ? { ...initial, delta: 0.02 } : fallbackAnchor ? { ...fallbackAnchor, delta: 0.05 } : fallback ? { ...fallback, delta: 0.5 } : { lat: 20, lng: 0, delta: 120 };

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPoint({ lat: latitude, lng: longitude });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setPoint(initial)}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: start.lat, longitude: start.lng, latitudeDelta: start.delta, longitudeDelta: start.delta }}
          onPress={onMapPress}
          showsUserLocation
          userInterfaceStyle={dark ? 'dark' : 'light'}
          customMapStyle={dark ? DARK_MAP : undefined}
        >
          {point ? <Marker coordinate={{ latitude: point.lat, longitude: point.lng }} draggable onDragEnd={(e) => setPoint({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })} pinColor={colors.accent} /> : null}
        </MapView>
        <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="hand-left-outline" size={14} color={colors.textMuted} />
            <Text variant="caption" muted>
              Tap to place, drag to adjust
            </Text>
          </View>
          <IconButton name="close" label="Close map" onPress={onClose} style={{ backgroundColor: colors.surface, borderRadius: 999 }} />
        </View>
        <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.bg, gap: spacing.sm }}>
          <Button
            title={point ? 'Use this spot' : 'Tap the map to choose a spot'}
            disabled={!point}
            onPress={() => {
              if (point) onPick(point);
              onClose();
            }}
          />
          {point ? (
            <Text variant="caption" faint style={{ textAlign: 'center' }}>
              {formatCoords(point)}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
