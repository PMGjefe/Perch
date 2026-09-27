import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, IconButton, Input, Row, Text } from '@/components/ui';
import { formatCoords, getCurrentLocation, type LatLng, reverseGeocode } from '@/lib/geo';
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
  const { colors } = useTheme();
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const useCurrent = async () => {
    setLocating(true);
    const p = await getCurrentLocation();
    setLocating(false);
    if (!p) return;
    onChange(p);
    if (!placeName && !hidePlaceName) {
      const name = await reverseGeocode(p);
      if (name) onPlaceNameChange(name);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" muted>
        {label}
      </Text>
      {hidePlaceName ? null : <Input value={placeName} onChangeText={onPlaceNameChange} placeholder="Place name (park, patch, backyard)" />}
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label={locating ? 'Locating…' : 'Current location'} icon="locate" onPress={useCurrent} active={!!value && !locating} />
        <Chip label={value ? 'Adjust on map' : 'Pick on map'} icon="map-outline" onPress={() => setMapOpen(true)} />
        {value ? <Chip label="Clear" icon="close" onPress={() => onChange(null)} /> : null}
      </Row>
      <Text variant="caption" muted>
        {value ? formatCoords(value) : status ?? 'No coordinates'}
      </Text>
      <MapPickerModal visible={mapOpen} initial={value} onClose={() => setMapOpen(false)} onPick={onChange} colors={colors} />
    </View>
  );
}

function MapPickerModal({ visible, initial, onClose, onPick, colors }: { visible: boolean; initial: LatLng | null; onClose: () => void; onPick: (p: LatLng) => void; colors: ReturnType<typeof useTheme>['colors'] }) {
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<LatLng | null>(initial);
  const center = point ?? initial ?? { lat: 47.6, lng: -122.33 };

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPoint({ lat: latitude, lng: longitude });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setPoint(initial)}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: initial ? 0.02 : 0.5, longitudeDelta: initial ? 0.02 : 0.5 }}
          onPress={onMapPress}
          showsUserLocation
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
          <IconButton name="close" onPress={onClose} style={{ backgroundColor: colors.surface, borderRadius: 999 }} />
        </View>
        <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, backgroundColor: colors.bg }}>
          <Button
            title={point ? `Use ${formatCoords(point)}` : 'Tap the map to choose a spot'}
            disabled={!point}
            onPress={() => {
              if (point) onPick(point);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
