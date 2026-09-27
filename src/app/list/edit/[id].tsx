import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpeciesPicker } from '@/components/SpeciesPicker';
import { BottomInset, Button, Card, Chip, Divider, IconButton, Input, Loading, Row, Screen, Text } from '@/components/ui';
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

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isNew ? 'New list' : 'Edit list' }} />
      <Screen scroll style={{ gap: spacing.lg }}>
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

        <View style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label" muted>
              Items ({items.length})
            </Text>
            <Row>
              <Chip label="Add species" icon="leaf-outline" onPress={() => setSpeciesOpen(true)} />
              <Chip label="Add sighting" icon="eye-outline" onPress={() => setSightingOpen(true)} />
            </Row>
          </Row>
          {items.map((it, i) => {
            const local = it.sighting_id ? db.getSighting(it.sighting_id) : null;
            const sp = speciesByCode(it.species_code ?? local?.species_code);
            return (
              <Card key={it.key} style={{ padding: spacing.sm, gap: spacing.xs }}>
                <Row>
                  <Text variant="caption" faint style={{ width: 20, textAlign: 'right' }}>
                    {i + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading" numberOfLines={1}>
                      {sp?.common ?? it.species_code ?? 'Sighting'}
                    </Text>
                    {local ? (
                      <Text variant="caption" muted>
                        {[local.place_name, formatDate(local.observed_at)].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <IconButton name="chevron-up" size={18} onPress={() => move(i, -1)} style={{ padding: 4 }} />
                  <IconButton name="chevron-down" size={18} onPress={() => move(i, 1)} style={{ padding: 4 }} />
                  <IconButton name="close" size={18} color={colors.danger} onPress={() => setItems(items.filter((x) => x.key !== it.key))} style={{ padding: 4 }} />
                </Row>
                <Input value={it.note} onChangeText={(t) => setItems(items.map((x) => (x.key === it.key ? { ...x, note: t } : x)))} placeholder="Note (optional)" maxLength={300} style={{ paddingVertical: 8, fontSize: 14 }} />
              </Card>
            );
          })}
        </View>

        <Button title={isNew ? 'Create list' : 'Save list'} onPress={save} loading={saving} />
        <BottomInset />
      </Screen>

      <SpeciesPicker visible={speciesOpen} onClose={() => setSpeciesOpen(false)} onSelect={(s) => setItems([...items, { key: `${Date.now()}`, species_code: s.code, sighting_id: null, note: '' }])} />
      <SightingPickerModal visible={sightingOpen} userId={userId} onClose={() => setSightingOpen(false)} onSelect={(sid) => setItems([...items, { key: `${Date.now()}`, species_code: null, sighting_id: sid, note: '' }])} />
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
