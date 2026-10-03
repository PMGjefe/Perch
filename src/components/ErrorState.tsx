import React from 'react';

import { Button, Empty } from '@/components/ui';

/** Network/server failure with a retry. Use whenever a useAsync `error` is set. */
export function ErrorState({ error, onRetry, title = "Couldn't load" }: { error: string; onRetry?: () => void; title?: string }) {
  const offline = /network|fetch|offline/i.test(error);
  return (
    <Empty
      icon="cloud-offline-outline"
      title={offline ? 'You appear to be offline' : title}
      body={offline ? 'Your own sightings still work. Try again when you are back online.' : error}
      action={onRetry ? <Button title="Retry" kind="secondary" onPress={onRetry} /> : undefined}
    />
  );
}
