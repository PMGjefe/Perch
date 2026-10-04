import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateTimeField } from '@/components/DateTimeField';
import { LocationField } from '@/components/LocationField';
import { PhotoField, type PickedPhoto } from '@/components/PhotoField';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { useBottomPadding } from '@/components/TabBarInset';
import { BottomInset, Button, Chip, Input, Row, SwitchRow, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import * as db from '@/lib/db';
import { formatDay, formatTime } from '@/lib/format';
import { getLocationIfGranted, type LatLng, reverseGeocode } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { usePhotoUrl } from '@/lib/photos';
import { speciesByCode, type SpeciesEntry } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';
import type { Visibility } from '@/types/db';

interface Props {
  userId: string;
  existing?: db.LocalSighting | null;
  onSaved: (s: db.LocalSighting) => void;
  /** Called after a successful save in "new" mode so the parent can reset. */
  resetKey?: number;
  /** Open the species picker as soon as the form mounts (initial state only, never re-applied). */
  autoOpenPicker?: boolean;
  /** The form owns its scroll view and floats a "Log it" bar above it, outside the scroll. */
  sticky?: boolean;
  /** Rendered above the headline (sticky mode). */
  header?: React.ReactNode;
}

const VISIBILITIES: { value: Visibility; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'public', label: 'Public', icon: 'earth-outline' },
  { value: 'followers', label: 'Followers', icon: 'people-outline' },
  { value: 'private', label: 'Only me', icon: 'lock-closed-outline' },
];

export function SightingForm({ userId, existing, onSaved, resetKey, autoOpenPicker, sticky, header }: Props) {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomPadding(spacing.md);
  const reduced = useReducedMotion();
  const [species, setSpecies] = useState<SpeciesEntry | null>(speciesByCode(existing?.species_code) ?? null);
  // SpeciesPicker autofocuses its input, so with autoOpenPicker the keyboard is up on arrival.
  const [pickerOpen, setPickerOpen] = useState(!!autoOpenPicker && !existing);
  const [when, setWhen] = useState<Date>(existing ? new Date(existing.observed_at) : new Date());
  const [where, setWhere] = useState<LatLng | null>(existing?.lat != null && existing.lng != null ? { lat: existing.lat, lng: existing.lng } : null);
  const [placeName, setPlaceName] = useState(existing?.place_name ?? '');
  // Either a local file picked in this session, the existing remote photo, or nothing.
  const [photo, setPhoto] = useState<{ kind: 'local'; uri: string } | { kind: 'remote'; path: string } | null>(
    existing?.local_photo_uri ? { kind: 'local', uri: existing.local_photo_uri } : existing?.photo_path ? { kind: 'remote', path: existing.photo_path } : null,
  );
  const [photoChanged, setPhotoChanged] = useState(false);
  const remoteUrl = usePhotoUrl(photo?.kind === 'remote' ? photo.path : null);
  const photoPreview = photo?.kind === 'local' ? photo.uri : photo?.kind === 'remote' ? remoteUrl : null;
  const [note, setNote] = useState(existing?.note ?? '');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'public');
  const [sensitive, setSensitive] = useState(existing?.sensitive ?? false);
  const [locStatus, setLocStatus] = useState<string | null>(existing ? null : 'Tap “Current location” or pick on the map.');
  const [saving, setSaving] = useState(false);
  // Sharing controls are for experienced users; keep them folded unless the sighting already uses them.
  const [moreOpen, setMoreOpen] = useState(!!existing && (existing.visibility !== 'public' || existing.sensitive));
  const touchedWhen = useRef(!!existing);
  const touchedWhere = useRef(!!existing);
  const recent = useLocalQuery(() => db.recentSpecies(userId), [userId]);

  // New sighting: auto-fill GPS once.
  useEffect(() => {
    if (existing) return;
    // Only auto-fill when permission was already granted; the first prompt belongs to a user tap.
    let cancelled = false;
    const timeout = setTimeout(() => !cancelled && setLocStatus('Location is taking a while. Pick on the map or keep going.'), 8000);
    getLocationIfGranted().then(async (p) => {
      clearTimeout(timeout);
      if (cancelled || touchedWhere.current) return;
      if (!p) return;
      setWhere(p);
      setLocStatus(null);
      const name = await reverseGeocode(p);
      if (!cancelled && name && !touchedWhere.current) setPlaceName((cur) => cur || name);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [existing, resetKey]);

  const onPhoto = (p: PickedPhoto | null) => {
    setPhoto(p ? { kind: 'local', uri: p.uri } : null);
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
        localPhoto = photo?.kind === 'local' ? await persistPhoto(photo.uri, id) : null;
        photoPath = photo?.kind === 'remote' ? photo.path : null; // cleared or replaced: re-upload on sync
        if (existing?.local_photo_uri && existing.local_photo_uri !== localPhoto) db.deleteLocalFile(existing.local_photo_uri);
        // Cleared: delete the storage object on sync. Replaced: the upload overwrites it, so cancel any queued removal.
        if (existing?.photo_path) {
          if (!photo) db.queuePhotoRemoval(existing.photo_path);
          else db.clearPhotoRemoval(existing.photo_path);
        }
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
      haptic.success();
      onSaved(row);
    } catch (e) {
      haptic.warning();
      if (__DEV__) console.warn('[perch] save failed', e);
      Alert.alert('Could not save', 'Something went wrong saving this bird. Everything you typed is still here, so try again.');
    } finally {
      setSaving(false);
    }
  };

  // eBird's entry screen: a search field, then the birds you log most, one tap each.
  const recentRows = recent.slice(0, 6).map((c) => speciesByCode(c)).filter((x): x is SpeciesEntry => !!x);
  const headline = (
    <View style={{ gap: spacing.md }}>
      {species ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Species: ${species.common}. Change`} onPress={() => setPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" numberOfLines={2}>
              {species.common}
            </Text>
            <Text style={{ fontFamily: fonts.displayItalic, fontSize: 16, color: colors.textMuted }}>{species.sci}</Text>
          </View>
          <Text variant="label" style={{ color: colors.accent }}>
            Change
          </Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            accessibilityRole="search"
            onPress={() => setPickerOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: spacing.md, height: 40 }}
          >
            <Ionicons name="search" size={18} color={colors.textFaint} />
            <Text muted style={{ fontSize: 17 }}>
              Search birds
            </Text>
          </Pressable>
          {recentRows.length ? (
            <View>
              <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 0.6, paddingBottom: 6, paddingLeft: 4 }}>
                Your usual birds
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                {recentRows.map((r, i) => (
                  <Pressable key={r.code} onPress={() => setSpecies(r)} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: spacing.md, gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="species" numberOfLines={1}>
                          {r.common}
                        </Text>
                        <Text variant="caption" muted numberOfLines={1}>
                          {r.family}
                        </Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
                    </View>
                    {i < recentRows.length - 1 ? <View style={{ height: 0.5, backgroundColor: colors.border, marginLeft: spacing.md }} /> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  const fields = (
    <>
      <PhotoField uri={photoPreview} onChange={onPhoto} />

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

      <Pressable onPress={() => setMoreOpen((o) => !o)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' }}>
        <Ionicons name={moreOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
        <Text variant="label" muted>
          {moreOpen ? 'Fewer options' : visibility === 'public' && !sensitive ? 'More options' : `More options · ${VISIBILITIES.find((v) => v.value === visibility)?.label}${sensitive ? ' · sensitive' : ''}`}
        </Text>
      </Pressable>
      {moreOpen ? (
        <View style={{ gap: spacing.lg }}>
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
          <SwitchRow label="Sensitive location" caption="Nest, roost, rarity. Others see the sighting but never the pin." value={sensitive} onValueChange={setSensitive} />
        </View>
      ) : null}
    </>
  );

  const picker = <SpeciesPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setSpecies} suggestions={recent} />;

  if (sticky) {
    // What the bar will save, in one line: time (or day), place, photo.
    const summary = [
      formatDay(when) === 'Today' ? formatTime(when) : formatDay(when),
      placeName.trim() || (where ? 'Pinned' : 'No location'),
      photo ? 'Photo' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.xl, paddingBottom: bottomPad + 96 }}
        >
          <View style={{ gap: spacing.sm }}>
            {header}
            {headline}
          </View>
          {fields}
          <BottomInset />
        </ScrollView>
        {picker}
        {species ? (
          // Outside the scroll view, so it stays put while the form scrolls and rides above the keyboard.
          <Animated.View
            entering={reduced ? undefined : FadeInUp.springify().damping(18).stiffness(220)}
            style={{
              position: 'absolute',
              left: spacing.lg,
              right: spacing.lg,
              bottom: bottomPad,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              padding: spacing.md,
              gap: spacing.xs,
              shadowColor: '#000',
              shadowOpacity: dark ? 0.4 : 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Button title="Log it" icon="checkmark" onPress={save} loading={saving} />
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              {summary}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.xl }}>
      {headline}
      {picker}
      {fields}
      <Button title={existing ? 'Save changes' : species ? 'Log it' : 'Pick a species first'} onPress={save} loading={saving} disabled={!species} icon={existing ? undefined : 'checkmark'} />
      <BottomInset />
    </View>
  );
}

/** Copy a picked image into the app's document dir so it survives cache cleanup until uploaded. */
async function persistPhoto(uri: string, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create();
  // Unique name per pick: expo-image caches by URI, so reusing a path would keep showing the old photo.
  const dest = new File(dir, `${id}-${Date.now()}.jpg`);
  new File(uri).copy(dest);
  return dest.uri;
}
