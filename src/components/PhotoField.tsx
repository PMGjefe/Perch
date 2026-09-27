import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Chip, IconButton, Row, Text } from '@/components/ui';
import { exifDate, exifLocation, type LatLng } from '@/lib/geo';
import { radius, spacing, useTheme } from '@/lib/theme';

export interface PickedPhoto {
  uri: string;
  exifDate: Date | null;
  exifLocation: LatLng | null;
}

interface Props {
  uri: string | null;
  onChange: (p: PickedPhoto | null) => void;
}

const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.75, exif: true, allowsEditing: false };

export function PhotoField({ uri, onChange }: Props) {
  const { colors } = useTheme();

  const handle = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    onChange({ uri: a.uri, exifDate: exifDate(a.exif), exifLocation: exifLocation(a.exif) });
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photos', 'Allow photo library access in Settings to attach a photo.');
    handle(await ImagePicker.launchImageLibraryAsync(options));
  };
  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera', 'Allow camera access in Settings to take a photo.');
    handle(await ImagePicker.launchCameraAsync(options));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" muted>
        Photo
      </Text>
      {uri ? (
        <View>
          <Image source={{ uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }} contentFit="cover" />
          <IconButton name="close-circle" size={28} color="#fff" onPress={() => onChange(null)} style={{ position: 'absolute', top: 4, right: 4 }} />
        </View>
      ) : (
        <Pressable onPress={fromLibrary} style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="image-outline" size={28} color={colors.textFaint} />
          <Text variant="caption" muted>
            Optional. Date and location are read from the photo if present.
          </Text>
        </Pressable>
      )}
      <Row>
        <Chip label="Camera" icon="camera-outline" onPress={fromCamera} />
        <Chip label="Library" icon="images-outline" onPress={fromLibrary} />
      </Row>
    </View>
  );
}
