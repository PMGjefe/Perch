import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { BottomInset, Button, Card, Chip, Row, Screen, StatRow, Text } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { importCsv, type ImportResult } from '@/lib/csv';
import * as db from '@/lib/db';
import { errorMessage, friendlyError } from '@/lib/errors';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { spacing, useTheme } from '@/lib/theme';
import type { Visibility } from '@/types/db';

/** One sentence about what is in the file, the way a person would say it, instead of a table of counts. */
function summarize(result: ImportResult, alreadyHave: number): string {
  if (!result.rows.length) return 'We could not find any sightings in that file.';
  const speciesCount = new Set(result.rows.map((r) => r.species_code)).size;
  const years = result.rows.map((r) => Number(r.observed_at.slice(0, 4)));
  const minYear = years.reduce((a, b) => Math.min(a, b));
  const maxYear = years.reduce((a, b) => Math.max(a, b));
  const span = minYear === maxYear ? ` from ${minYear}` : ` from ${minYear} to ${maxYear}`;
  const known = alreadyHave ? ` ${alreadyHave} ${alreadyHave === 1 ? 'is' : 'are'} already in your diary.` : '';
  return `We found ${plural(result.rows.length, 'sighting')} across ${plural(speciesCount, 'species', 'species')}${span}.${known}`;
}

export default function ImportScreen() {
  const userId = useUserId();
  const router = useRouter();
  const { colors } = useTheme();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [busy, setBusy] = useState(false);
  const [skippedOpen, setSkippedOpen] = useState(false);

  const fresh = useMemo(() => {
    if (!result) return [];
    const have = db.existingDedupeKeys(userId);
    return result.rows.filter((r) => !have.has(db.dedupeKey(r.species_code, r.observed_at, r.lat, r.lng)));
  }, [result, userId]);
  const alreadyHave = result ? result.rows.length - fresh.length : 0;
  const skippedAny = !!result && !!(result.duplicatesInFile || result.skippedNoDate || result.unmatched.length);

  const fail = (message: string) => {
    haptic.warning();
    Alert.alert('Could not read that file', message);
  };

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'public.comma-separated-values-text', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    setBusy(true);
    try {
      let text: string;
      try {
        text = await new File(res.assets[0].uri).text();
      } catch (e) {
        fail(friendlyError(e, 'It needs to be a CSV export from eBird or Merlin.'));
        return;
      }
      try {
        setResult(importCsv(text));
      } catch (e) {
        // csv.ts writes its own plain words ("That file has more than 50,000 rows. Split it and import in parts."),
        // which friendlyError would flatten into the fallback, so they are shown as written.
        fail(errorMessage(e));
        return;
      }
      setFileName(res.assets[0].name);
      setSkippedOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const toggleSkipped = () => {
    haptic.select();
    setSkippedOpen((open) => !open);
  };

  const run = () => {
    if (!fresh.length) return;
    setBusy(true);
    const count = fresh.length;
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
    haptic.success();
    Alert.alert('Added', `${plural(count, 'bird')} added to your diary.`, [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <Screen scroll style={{ gap: spacing.xl }}>
      <Stack.Screen options={{ title: 'Import sightings' }} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="title">Bring your history</Text>
        <Text muted>Have an eBird or Merlin export? Choose the file and Perch adds every bird to your diary and life list. Anything you already have is skipped.</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title={result ? 'Choose a different file' : 'Choose a file'} icon="document-outline" kind={result ? 'secondary' : 'primary'} onPress={pick} loading={busy && !result} />
        <Text variant="caption" faint style={{ textAlign: 'center' }}>
          In eBird: Account → Download my data → My eBird Data. In Merlin: Saved birds → export.
        </Text>
      </View>

      {result ? (
        <Card style={{ padding: spacing.lg, gap: spacing.md }}>
          <Row>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
              {fileName}
            </Text>
            <Chip label={result.source === 'ebird' ? 'eBird' : 'Merlin'} />
          </Row>
          <Text variant="heading">{fresh.length ? plural(fresh.length, 'new bird') : 'Nothing new'}</Text>
          <Text>{summarize(result, alreadyHave)}</Text>

          {skippedAny ? (
            <View style={{ gap: spacing.sm }}>
              <Pressable onPress={toggleSkipped} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button" accessibilityState={{ expanded: skippedOpen }} accessibilityLabel="What we skipped">
                <Row gap={spacing.xs}>
                  <Ionicons name={skippedOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
                  <Text variant="label" muted>
                    What we skipped
                  </Text>
                </Row>
              </Pressable>
              {skippedOpen ? (
                <View style={{ gap: spacing.sm }}>
                  {result.duplicatesInFile ? <StatRow label="Listed twice in the file" value={result.duplicatesInFile} /> : null}
                  {result.skippedNoDate ? <StatRow label="Missing a date" value={result.skippedNoDate} /> : null}
                  {result.unmatched.length ? (
                    <View style={{ gap: 4 }}>
                      <StatRow label="Names we could not match" value={result.unmatched.length} />
                      <Text variant="caption" faint numberOfLines={3}>
                        {result.unmatched.slice(0, 8).join(', ')}
                        {result.unmatched.length > 8 ? '…' : ''}
                      </Text>
                      <Text variant="caption" faint>
                        Usually hybrids, “gull sp.” style entries and subspecies. Log those by hand if you want them.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}

      {result ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" muted>
            Who can see imported sightings
          </Text>
          <Row>
            <Chip label="Public" icon="earth-outline" active={visibility === 'public'} onPress={() => setVisibility('public')} />
            <Chip label="Followers" icon="people-outline" active={visibility === 'followers'} onPress={() => setVisibility('followers')} />
            <Chip label="Only me" icon="lock-closed-outline" active={visibility === 'private'} onPress={() => setVisibility('private')} />
          </Row>
          <Text variant="caption" faint>
            You can change any sighting later.
          </Text>
        </View>
      ) : null}

      {result ? <Button title={fresh.length ? `Add ${plural(fresh.length, 'bird')} to my diary` : 'Nothing new to add'} onPress={run} disabled={!fresh.length} loading={busy && !!result} icon="download-outline" /> : null}
      <BottomInset />
    </Screen>
  );
}
