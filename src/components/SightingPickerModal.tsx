import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, IconButton, Input, Row, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import * as db from '@/lib/db';
import { formatDate } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing, useTheme } from '@/lib/theme';

/** Pick one of the user's own synced sightings (for adding to a list). */
export function SightingPickerModal({ visible, userId, onClose, onSelect }: { visible: boolean; userId: string; onClose: () => void; onSelect: (id: string) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const all = useLocalQuery(() => db.listSightings(userId).filter((s) => !s.dirty || db.getMeta(`synced:${s.id}`)), [userId]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((s) => (speciesByCode(s.species_code)?.common ?? '').toLowerCase().includes(term) || (s.place_name ?? '').toLowerCase().includes(term));
  }, [all, q]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top ? spacing.md : spacing.lg }}>
        <Row style={{ paddingHorizontal: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input value={q} onChangeText={setQ} placeholder="Filter your sightings" autoFocus />
          </View>
          <IconButton name="close" label="Close" onPress={onClose} />
        </Row>
        <Text variant="caption" muted style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          Only synced sightings can be added to a list.
        </Text>
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          ItemSeparatorComponent={Divider}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item.id);
                onClose();
              }}
              style={({ pressed }) => ({ paddingHorizontal: spacing.lg, paddingVertical: 12, backgroundColor: pressed ? colors.surfaceAlt : 'transparent', flexDirection: 'row', alignItems: 'center', gap: spacing.md })}
            >
              <Ionicons name="eye-outline" size={18} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{speciesByCode(item.species_code)?.common}</Text>
                <Text variant="caption" muted>
                  {[item.place_name, formatDate(item.observed_at)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text muted style={{ textAlign: 'center', padding: spacing.xl }}>
              No sightings to add yet.
            </Text>
          }
        />
      </View>
    </Modal>
  );
}
