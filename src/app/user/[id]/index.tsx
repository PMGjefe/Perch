import { Stack } from 'expo-router';

import { Empty, Screen } from '@/components/ui';

export default function UserScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Profile' }} />
      <Empty title="Coming soon" />
    </Screen>
  );
}
