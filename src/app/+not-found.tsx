import { Link, Stack } from 'expo-router';
import React from 'react';

import { Button, Empty, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <Empty
        icon="compass-outline"
        title="Nothing perched here"
        body="That link does not point anywhere we know."
        action={
          <Link href="/(tabs)/diary" asChild>
            <Button title="Back to my diary" />
          </Link>
        }
      />
    </Screen>
  );
}
