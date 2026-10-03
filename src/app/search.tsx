import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';

import { ProfileRow } from '@/components/ProfileRow';
import { Divider, Empty, Input } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { searchProfiles } from '@/lib/social';
import { spacing, useTheme } from '@/lib/theme';
import type { PublicProfile } from '@/types/db';

export default function Search() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ term: string; results: PublicProfile[]; error: string | null }>({ term: '', results: [], error: null });
  const term = q.trim();
  const pending = term.length >= 2 && state.term !== term;

  useEffect(() => {
    if (term.length < 2) return;
    let active = true;
    const t = setTimeout(
      () =>
        searchProfiles(term)
          .then((r) => active && setState({ term, results: r, error: null }))
          .catch((e: unknown) => active && setState({ term, results: [], error: friendlyError(e, 'Could not search right now.') })),
      250,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term]);
  const results = state.term === term ? state.results : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Find people' }} />
      <View style={{ padding: spacing.lg }}>
        <Input value={q} onChangeText={setQ} placeholder="Username or name" autoFocus autoCapitalize="none" autoCorrect={false} />
      </View>
      <FlatList
        data={term.length < 2 ? [] : results}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={Divider}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ProfileRow profile={item} />}
        ListEmptyComponent={
          pending ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
          ) : state.error && state.term === term ? (
            <ErrorState error={state.error} onRetry={() => setState({ term: '', results: [], error: null })} />
          ) : (
            <Empty icon="search-outline" title={term.length < 2 ? 'Search for birders' : 'No one found'} body={term.length < 2 ? 'Try a username.' : undefined} />
          )
        }
      />
    </View>
  );
}
