import { Stack } from 'expo-router';

import { Empty, Screen } from '@/components/ui';

export default function Followers() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Followers' }} />
      <Empty title="Coming soon" />
    </Screen>
  );
}
