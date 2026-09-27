import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { DateTimeField } from '@/components/DateTimeField';
import { LocationField } from '@/components/LocationField';
import { PhotoField, type PickedPhoto } from '@/components/PhotoField';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { BottomInset, Button, Chip, Input, Row, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import * as db from '@/lib/db';
import { getCurrentLocation, type LatLng, reverseGeocode } from '@/lib/geo';
import { photoUrl } from '@/lib/supabase';
import { speciesByCode, type SpeciesEntry } from '@/lib/taxonomy';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Visibility } from '@/types/db';

interface Props {
  userId: string;
  existing?: db.LocalSighting | null;
  onSaved: (s: db.LocalSighting) => void;
  /** Called after a successful save in "new" mode so the parent can reset. */
  resetKey?: number;
}

const VISIBILITIES: { value: Visibility; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'public', label: 'Public', icon: 'earth-outline' },
  { value: 'followers', label: 'Followers', icon: 'people-outline' },
  { value: 'private', label: 'Only me', icon: 'lock-closed-outline' },
];

export function SightingForm({ userId, existing, onSaved, resetKey }: Props) {
  const { colors } = useTheme();
  const [species, setSpecies] = useState<SpeciesEntry | null>(speciesByCode(existing?.species_code) ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [when, setWhen] = useState<Date>(existing ? new Date(existing.observed_at) : new Date());
  const [where, setWhere] = useState<LatLng | null>(existing?.lat != null && existing.lng != null ? { lat: existing.lat, lng: existing.lng } : null);
  const [placeName, setPlaceName] = useState(existing?.place_name ?? '');
  const [photo, setPhoto] = useState<string | null>(existing?.local_photo_uri ?? photoUrl(existing?.photo_path) ?? null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [note, setNote] = useState(existing?.note ?? '');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'public');
  const [sensitive, setSensitive] = useState(existing?.sensitive ?? false);
  const [locStatus, setLocStatus] = useState<string | null>(existing ? null : 'Finding your location…');
  const [saving, setSaving] = useState(false);
  const touchedWhen = useRef(!!existing);
  const touchedWhere = useRef(!!existing);
  const recent = useLocalQuery(() => db.recentSpecies(userId), [userId]);

  // New sighting: auto-fill GPS once.
  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    getCurrentLocation().then(async (p) => {
      if (cancelled || touchedWhere.current) return;
      if (!p) return setLocStatus('Location unavailable. Pick on the map or leave blank.');
      setWhere(p);
      setLocStatus(null);
      const name = await reverseGeocode(p);
      if (!cancelled && name && !touchedWhere.current) setPlaceName((cur) => cur || name);
    });
    return () => {
      cancelled = true;
    };
  }, [existing, resetKey]);

  const onPhoto = (p: PickedPhoto | null) => {
    setPhoto(p?.uri ?? null);
    setPhotoChanged(true);
    if (!p) return;
    // Prefer the photo's own metadata unless the user already changed the fields.
    if (p.exifDate && !touchedWhen.current) setWhen(p.exifDate);
    if (p.exifLocation && !touchedWhere.current) {
      setWhere(p.exifLocation);
      reverseGeocode(p.exifLocation).then((name) => name && setPlaceName((cur) => cur || name));
    }
  };

  const save = async () => {
    if (!species) return Alert.alert('Which bird?', 'Pick a species first.');
    setSaving(true);
    try {
      const id = existing?.id ?? Crypto.randomUUID();
      let localPhoto = existing?.local_photo_uri ?? null;
      let photoPath = existing?.photo_path ?? null;
      if (photoChanged) {
        localPhoto = photo && !photo.startsWith('http') ? await persistPhoto(photo, id) : null;
        photoPath = photo && photo.startsWith('http') ? existing?.photo_path ?? null : null; // cleared or replaced: re-upload on sync
        // Photo cleared: make sure the old storage object goes away too (a replacement overwrites the same path).
        if (!photo && existing?.photo_path) db.queuePhotoRemoval(existing.photo_path);
      }
      const row = db.saveSighting({
        id,
        user_id: userId,
        species_code: species.code,
        observed_at: when.toISOString(),
        lat: where?.lat ?? null,
        lng: where?.lng ?? null,
        place_name: placeName.trim() || null,
        photo_path: photoPath,
        local_photo_uri: localPhoto,
        note: note.trim(),
        visibility,
        sensitive,
        source: existing?.source ?? 'app',
        source_ref: existing?.source_ref ?? null,
        created_at: existing?.created_at,
      });
      onSaved(row);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => ({
          backgroundColor: species ? colors.surface : colors.accent,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: species ? 1 : 0,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        })}
      >
        <Ionicons name={species ? 'checkmark-circle' : 'search'} size={26} color={species ? colors.accent : colors.onAccent} />
        <View style={{ flex: 1 }}>
          {species ? (
            <>
              <Text variant="heading">{species.common}</Text>
              <Text variant="caption" muted>
                {species.sci} · tap to change
              </Text>
            </>
          ) : (
            <Text variant="heading" style={{ color: colors.onAccent }}>
              Which bird?
            </Text>
          )}
        </View>
      </Pressable>
      <SpeciesPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setSpecies} suggestions={recent} />

      <PhotoField uri={photo} onChange={onPhoto} />

      <DateTimeField
        value={when}
        onChange={(d) => {
          touchedWhen.current = true;
          setWhen(d);
        }}
      />

      <LocationField
        value={where}
        placeName={placeName}
        status={locStatus}
        onChange={(p) => {
          touchedWhere.current = true;
          setWhere(p);
        }}
        onPlaceNameChange={setPlaceName}
      />

      <Input label="Note" value={note} onChangeText={setNote} placeholder="Behaviour, count, who you were with…" multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />

      <View style={{ gap: spacing.sm }}>
        <Text variant="label" muted>
          Who can see this
        </Text>
        <Row>
          {VISIBILITIES.map((v) => (
            <Chip key={v.value} label={v.label} icon={v.icon} active={visibility === v.value} onPress={() => setVisibility(v.value)} />
          ))}
        </Row>
      </View>

      <Row style={{ justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">Sensitive location</Text>
          <Text variant="caption" muted>
            Nest, roost, rarity. Others see the sighting but never the pin.
          </Text>
        </View>
        <Switch value={sensitive} onValueChange={setSensitive} trackColor={{ true: colors.accent }} />
      </Row>

      <Button title={existing ? 'Save changes' : 'Log it'} onPress={save} loading={saving} icon={existing ? undefined : 'checkmark'} />
      <BottomInset />
    </View>
  );
}

/** Copy a picked image into the app's document dir so it survives cache cleanup until uploaded. */
async function persistPhoto(uri: string, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create();
  const dest = new File(dir, `${id}.jpg`);
  if (dest.exists) dest.delete();
  new File(uri).copy(dest);
  return dest.uri;
}
