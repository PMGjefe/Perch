import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, IconButton, Text } from '@/components/ui';
import { searchSpecies, speciesByCode, type SpeciesEntry } from '@/lib/taxonomy';
import { radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (s: SpeciesEntry) => void;
  /** Species to show before the user types (e.g. recently logged). */
  suggestions?: string[];
}

export function SpeciesPicker({ visible, onClose, onSelect, suggestions = [] }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    if (q.trim()) return searchSpecies(q);
    return suggestions.map((c) => speciesByCode(c)).filter((s): s is SpeciesEntry => !!s);
  }, [q, suggestions]);

  const pick = (s: SpeciesEntry) => {
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
              autoCorrect={false}
              autoCapitalize="none"
              style={{ flex: 1, paddingVertical: 12, paddingHorizontal: spacing.sm, fontSize: 17, color: colors.text }}
            />
            {q ? <IconButton name="close-circle" size={18} color={colors.textFaint} onPress={() => setQ('')} /> : null}
          </View>
          <IconButton name="close" onPress={onClose} />
        </View>
        {!q && suggestions.length ? (
          <Text variant="caption" muted style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            Recent
          </Text>
        ) : null}
        <FlatList
          data={results}
          keyExtractor={(s) => s.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: spacing.sm }}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <Pressable onPress={() => pick(item)} style={({ pressed }) => ({ paddingHorizontal: spacing.lg, paddingVertical: 12, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
              <Text variant="subheading">{item.common}</Text>
              <Text variant="caption" muted>
                {item.sci} · {item.family}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            q ? (
              <Text muted style={{ textAlign: 'center', padding: spacing.xl }}>
                No species match “{q}”.
              </Text>
            ) : (
              <Text muted style={{ textAlign: 'center', padding: spacing.xl }}>
                Type a common or scientific name.
              </Text>
            )
          }
        />
      </View>
    </Modal>
  );
}
