import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';

import { ProfileRow } from '@/components/ProfileRow';
import { Divider, Empty, Input } from '@/components/ui';
import { searchProfiles } from '@/lib/social';
import { spacing, useTheme } from '@/lib/theme';
import type { PublicProfile } from '@/types/db';

export default function Search() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let active = true;
    const t = setTimeout(() => searchProfiles(term).then((r) => active && setResults(r)).catch(() => {}), 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Find people' }} />
      <View style={{ padding: spacing.lg }}>
        <Input value={q} onChangeText={setQ} placeholder="Username or name" autoFocus autoCapitalize="none" autoCorrect={false} />
      </View>
      <FlatList
        data={q.trim().length < 2 ? [] : results}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={Divider}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ProfileRow profile={item} />}
        ListEmptyComponent={<Empty icon="search-outline" title={q.trim().length < 2 ? 'Search for birders' : 'No one found'} body={q.trim().length < 2 ? 'Try a username.' : undefined} />}
      />
    </View>
  );
}
