import { Stack } from 'expo-router';

import { Empty, Screen } from '@/components/ui';

export default function Settings() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Empty title="Coming soon" />
    </Screen>
  );
}
