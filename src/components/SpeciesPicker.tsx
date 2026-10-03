import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Photo } from '@/components/Photo';
import { Divider, IconButton, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { haptic } from '@/lib/haptics';
import { usePrefetchPhotoUrls } from '@/lib/photos';
import { searchSpecies, speciesByCode, type SpeciesEntry } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (s: SpeciesEntry) => void;
  /** Species to show before the user types (e.g. recently logged). */
  suggestions?: string[];
}

type Row = { kind: 'header'; title: string } | { kind: 'species'; s: SpeciesEntry };

/** How many of the most-logged species to offer before the user types. */
const REGULARS = 6;
/** Score bump for a species already in the diary; see `searchSpecies` for how it ranks. */
const SEEN_BOOST = 15;

/** One species in the picker: its photo (or initial), names, and how often it has been logged. */
export function SpeciesRow({ s, count, photo, onPress }: { s: SpeciesEntry; count?: number; photo?: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  const label = count ? `${s.common}, seen ${count} ${count === 1 ? 'time' : 'times'}` : `${s.common}, lifer`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: 10,
        minHeight: 56,
        backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
      })}
    >
      <Photo
        path={photo}
        style={{ width: 40, height: 40, borderRadius: radius.sm }}
        fallback={
          <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.accent, fontFamily: fonts.displaySemi, fontSize: 16 }}>{s.common.charAt(0)}</Text>
          </View>
        }
      />
      <View style={{ flex: 1 }}>
        <Text variant="species" numberOfLines={1}>
          {s.common}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {s.sci} · {s.family}
        </Text>
      </View>
      {count ? (
        <Text variant="caption" faint>
          {count}×
        </Text>
      ) : (
        <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, height: 20, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1, color: colors.accent }}>Lifer</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Hairline between species rows; a section header carries its own breathing room. */
function RowSeparator({ leadingItem }: { leadingItem: Row }) {
  return leadingItem.kind === 'species' ? <Divider /> : null;
}

export function SpeciesPicker({ visible, onClose, onSelect, suggestions = [] }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const [q, setQ] = useState('');
  const counts = useLocalQuery(() => db.speciesCounts(userId), [userId]);
  const photos = useLocalQuery(() => new Map(db.lifeList(userId).map((e) => [e.species_code, e.photo])), [userId]);

  // Before typing: what was logged lately, then what gets logged most.
  const regulars = useMemo(() => {
    const recent = new Set(suggestions);
    return [...counts]
      .filter(([code]) => !recent.has(code))
      .sort((a, b) => b[1] - a[1])
      .slice(0, REGULARS)
      .map(([code]) => code);
  }, [counts, suggestions]);
  usePrefetchPhotoUrls([...suggestions, ...regulars].map((c) => photos.get(c)));

  const rows = useMemo<Row[]>(() => {
    if (q.trim()) return searchSpecies(q, 30, (c) => (counts.has(c) ? SEEN_BOOST : 0)).map((s) => ({ kind: 'species', s }));
    const out: Row[] = [];
    const section = (title: string, codes: string[]) => {
      const entries = codes.map((c) => speciesByCode(c)).filter((s): s is SpeciesEntry => !!s);
      if (!entries.length) return;
      out.push({ kind: 'header', title });
      for (const s of entries) out.push({ kind: 'species', s });
    };
    section('Recent', suggestions);
    section('Your regulars', regulars);
    return out;
  }, [q, suggestions, regulars, counts]);

  const pick = (s: SpeciesEntry) => {
    haptic.select();
    onSelect(s);
    setQ('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top ? spacing.md : spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
            <Ionicons name="search" size={18} color={colors.textFaint} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search a species"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Search a species"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: spacing.sm, fontSize: 17, color: colors.text }}
            />
            {q ? <IconButton name="close-circle" label="Clear search" size={18} color={colors.textFaint} onPress={() => setQ('')} /> : null}
          </View>
          <IconButton name="close" label="Close" onPress={onClose} />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r) => (r.kind === 'header' ? `h:${r.title}` : `s:${r.s.code}`)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          ItemSeparatorComponent={RowSeparator}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text variant="caption" muted style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
                {item.title}
              </Text>
            ) : (
              <SpeciesRow s={item.s} count={counts.get(item.s.code)} photo={photos.get(item.s.code)} onPress={() => pick(item.s)} />
            )
          }
          ListEmptyComponent={
            q ? (
              <Text muted style={{ textAlign: 'center', padding: spacing.xl }}>
                No species match “{q}”.
              </Text>
            ) : (
              <Text muted style={{ textAlign: 'center', padding: spacing.xl }}>
                Type a few letters of a name. Three is usually enough.
              </Text>
            )
          }
        />
      </View>
    </Modal>
  );
}
