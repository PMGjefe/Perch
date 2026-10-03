import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { BottomInset, Button, Card, Chip, Row, Screen, StatRow, Text } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { importCsv, type ImportResult } from '@/lib/csv';
import * as db from '@/lib/db';
import { spacing, useTheme } from '@/lib/theme';
import type { Visibility } from '@/types/db';

export default function ImportScreen() {
  const userId = useUserId();
  const router = useRouter();
  const { colors } = useTheme();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [busy, setBusy] = useState(false);

  const fresh = useMemo(() => {
    if (!result) return [];
    const have = db.existingDedupeKeys(userId);
    return result.rows.filter((r) => !have.has(db.dedupeKey(r.species_code, r.observed_at, r.lat, r.lng)));
  }, [result, userId]);
  const alreadyHave = result ? result.rows.length - fresh.length : 0;

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'public.comma-separated-values-text', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    setBusy(true);
    try {
      const text = await new File(res.assets[0].uri).text();
      setResult(importCsv(text));
      setFileName(res.assets[0].name);
    } catch (e) {
      Alert.alert('Could not read file', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const run = () => {
    if (!fresh.length) return;
    setBusy(true);
    const now = new Date().toISOString();
    db.saveMany(
      fresh.map((r) => ({
        id: Crypto.randomUUID(),
        user_id: userId,
        species_code: r.species_code,
        observed_at: r.observed_at,
        lat: r.lat,
        lng: r.lng,
        place_name: r.place_name,
        photo_path: null,
        local_photo_uri: null,
        note: r.note,
        visibility,
        sensitive: false,
        source: r.source,
        source_ref: r.source_ref,
        created_at: now,
        updated_at: now,
        dirty: 1,
        deleted: 0,
      })),
    );
    setBusy(false);
    Alert.alert('Imported', `${fresh.length} sightings added to your diary. They will sync in the background.`, [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <Screen scroll style={{ gap: spacing.xl }}>
      <Stack.Screen options={{ title: 'Import sightings' }} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="title">Bring your history</Text>
        <Text muted>
          Import a CSV from eBird (Account → Download my data → “My eBird Data”) or a Merlin saved-birds export. Species are matched to the eBird/Clements taxonomy. Rows with the same species, date and location as something you already have are skipped.
        </Text>
      </View>

      <Button title={result ? 'Choose a different file' : 'Choose CSV file'} icon="document-outline" kind={result ? 'secondary' : 'primary'} onPress={pick} loading={busy && !result} />

      {result ? (
        <Card style={{ padding: spacing.lg, gap: spacing.md }}>
          <Row>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
              {fileName}
            </Text>
            <Chip label={result.source === 'ebird' ? 'eBird' : 'Merlin'} />
          </Row>
          <StatRow label="Sightings recognised" value={result.rows.length} />
          <StatRow label="New to your diary" value={fresh.length} strong />
          {alreadyHave ? <StatRow label="Already in your diary (skipped)" value={alreadyHave} /> : null}
          {result.duplicatesInFile ? <StatRow label="Duplicate rows in file" value={result.duplicatesInFile} /> : null}
          {result.skippedNoDate ? <StatRow label="Rows without a usable date" value={result.skippedNoDate} /> : null}
          {result.unmatched.length ? (
            <View style={{ gap: 4 }}>
              <StatRow label="Names not in the taxonomy (skipped)" value={result.unmatched.length} />
              <Text variant="caption" faint numberOfLines={3}>
                {result.unmatched.slice(0, 8).join(', ')}
                {result.unmatched.length > 8 ? '…' : ''}
              </Text>
              <Text variant="caption" faint>
                Usually hybrids, spuhs (“gull sp.”) and subspecies groups.
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" muted>
            Visibility for imported sightings
          </Text>
          <Row>
            <Chip label="Public" icon="earth-outline" active={visibility === 'public'} onPress={() => setVisibility('public')} />
            <Chip label="Followers" icon="people-outline" active={visibility === 'followers'} onPress={() => setVisibility('followers')} />
            <Chip label="Only me" icon="lock-closed-outline" active={visibility === 'private'} onPress={() => setVisibility('private')} />
          </Row>
          <Text variant="caption" faint>
            You can change any sighting later. Nothing is marked sensitive by import.
          </Text>
        </View>
      ) : null}

      {result ? <Button title={fresh.length ? `Import ${fresh.length} sightings` : 'Nothing new to import'} onPress={run} disabled={!fresh.length} loading={busy && !!result} icon="download-outline" /> : null}
      <BottomInset />
    </Screen>
  );
}
