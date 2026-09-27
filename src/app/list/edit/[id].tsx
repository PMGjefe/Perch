import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Switch, View } from 'react-native';
import ReorderableList, { type ReorderableListRenderItemInfo, type ReorderableListReorderEvent, reorderItems } from 'react-native-reorderable-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DraggableItemCard, useReorderablePan } from '@/components/ReorderableItems';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { BottomInset, Button, Chip, Divider, IconButton, Input, Loading, Row, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { formatDate } from '@/lib/format';
import { fetchList, replaceListItems, saveList } from '@/lib/social';
import { speciesByCode } from '@/lib/taxonomy';
import { radius, spacing, useTheme } from '@/lib/theme';

interface Draft {
  key: string;
  species_code: string | null;
  sighting_id: string | null;
  note: string;
}

// Keep the library's default lift (scale) but stay fully opaque so the accent border and
// shadow of the lifted card read clearly. Module-level so the list context stays stable.
const CELL_ANIMATIONS = { opacity: 1 };

export default function EditList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const userId = useUserId();
  const router = useRouter();
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [items, setItems] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [speciesOpen, setSpeciesOpen] = useState(false);
  const [sightingOpen, setSightingOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useAsync(async () => {
    if (isNew) return null;
    const res = await fetchList(id);
    if (res) {
      setTitle(res.list.title);
      setDescription(res.list.description);
      setIsPublic(res.list.is_public);
      setItems(res.items.map((it) => ({ key: it.id, species_code: it.species_code, sighting_id: it.sighting_id, note: it.note })));
    }
    setLoaded(true);
    return res;
  }, [id]);

  const { panGesture, onDragStart, onDragEnd } = useReorderablePan();

  const handleReorder = useCallback(({ from, to }: ReorderableListReorderEvent) => {
    setItems((prev) => reorderItems(prev, from, to));
  }, []);
  const changeNote = useCallback((key: string, note: string) => {
    setItems((prev) => prev.map((x) => (x.key === key ? { ...x, note } : x)));
  }, []);
  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((x) => x.key !== key));
  }, []);
  const moveItem = useCallback((key: string, direction: -1 | 1) => {
    setItems((prev) => {
      const from = prev.findIndex((x) => x.key === key);
      const to = from + direction;
      return from < 0 || to < 0 || to >= prev.length ? prev : reorderItems(prev, from, to);
    });
  }, []);

  const renderItem = ({ item, index }: ReorderableListRenderItemInfo<Draft>) => {
    const local = item.sighting_id ? db.getSighting(item.sighting_id) : null;
    const sp = speciesByCode(item.species_code ?? local?.species_code);
    return (
      <DraggableItemCard
        itemKey={item.key}
        index={index}
        title={sp?.common ?? item.species_code ?? 'Sighting'}
        subtitle={local ? [local.place_name, formatDate(local.observed_at)].filter(Boolean).join(' · ') : null}
        note={item.note}
        onChangeNote={changeNote}
        onRemove={removeItem}
        onMove={moveItem}
      />
    );
  };

  const save = async () => {
    if (!title.trim()) return Alert.alert('Give the list a title');
    setSaving(true);
    try {
      const list = await saveList({ ...(isNew ? {} : { id }), user_id: userId, title: title.trim(), description: description.trim(), is_public: isPublic });
      await replaceListItems(list.id, items.map(({ species_code, sighting_id, note }) => ({ species_code, sighting_id, note: note.trim() })));
      if (isNew) router.replace({ pathname: '/list/[id]', params: { id: list.id } });
      else router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <Loading />;

  // Header and footer are passed as elements (not component functions) so their Inputs keep
  // identity - and focus - across re-renders while typing.
  const header = (
    <View style={{ gap: spacing.lg, marginBottom: spacing.sm }}>
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="Birds of my commute" maxLength={80} />
      <Input label="Description" value={description} onChangeText={setDescription} placeholder="Optional" multiline maxLength={500} style={{ minHeight: 60, textAlignVertical: 'top' }} />
      <Row style={{ justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flex: 1 }}>
          <Text variant="label">Public</Text>
          <Text variant="caption" muted>
            Anyone can find and follow it. Private lists are only for you.
          </Text>
        </View>
        <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.accent }} />
      </Row>

      <View style={{ gap: spacing.xs }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="label" muted>
            Items ({items.length})
          </Text>
          <Row>
            <Chip label="Add species" icon="leaf-outline" onPress={() => setSpeciesOpen(true)} />
            <Chip label="Add sighting" icon="eye-outline" onPress={() => setSightingOpen(true)} />
          </Row>
        </Row>
        {items.length > 1 ? (
          <Text variant="caption" faint>
            Hold a row and drag it to reorder.
          </Text>
        ) : null}
      </View>
    </View>
  );

  const footer = (
    <View style={{ paddingTop: spacing.sm }}>
      <Button title={isNew ? 'Create list' : 'Save list'} onPress={save} loading={saving} />
      <BottomInset />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isNew ? 'New list' : 'Edit list' }} />
      <ReorderableList
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={renderItem}
        onReorder={handleReorder}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        panGesture={panGesture}
        shouldUpdateActiveItem
        cellAnimations={CELL_ANIMATIONS}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.lg }}
      />

      <SpeciesPicker visible={speciesOpen} onClose={() => setSpeciesOpen(false)} onSelect={(s) => setItems((prev) => [...prev, { key: `${Date.now()}`, species_code: s.code, sighting_id: null, note: '' }])} />
      <SightingPickerModal visible={sightingOpen} userId={userId} onClose={() => setSightingOpen(false)} onSelect={(sid) => setItems((prev) => [...prev, { key: `${Date.now()}`, species_code: null, sighting_id: sid, note: '' }])} />
    </KeyboardAvoidingView>
  );
}

function SightingPickerModal({ visible, userId, onClose, onSelect }: { visible: boolean; userId: string; onClose: () => void; onSelect: (id: string) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const all = db.listSightings(userId).filter((s) => !s.dirty || db.getMeta(`synced:${s.id}`));
  const rows = q ? all.filter((s) => (speciesByCode(s.species_code)?.common ?? '').toLowerCase().includes(q.toLowerCase()) || (s.place_name ?? '').toLowerCase().includes(q.toLowerCase())) : all;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top ? spacing.md : spacing.lg }}>
        <Row style={{ paddingHorizontal: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input value={q} onChangeText={setQ} placeholder="Filter your sightings" autoFocus />
          </View>
          <IconButton name="close" onPress={onClose} />
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
