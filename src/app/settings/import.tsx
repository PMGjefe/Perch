import { Stack } from 'expo-router';

import { Empty, Screen } from '@/components/ui';

export default function ImportScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Import' }} />
      <Empty title="Coming soon" />
    </Screen>
  );
}
