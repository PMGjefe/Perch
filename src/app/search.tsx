import { Stack } from 'expo-router';

import { Empty, Screen } from '@/components/ui';

export default function Search() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Find people' }} />
      <Empty title="Coming soon" />
    </Screen>
  );
}
