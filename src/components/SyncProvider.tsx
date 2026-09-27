import React, { createContext, useContext } from 'react';

import { useAuth } from '@/lib/auth';
import { useSync } from '@/lib/sync';

type SyncState = ReturnType<typeof useSync>;
const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const state = useSync(session?.user.id ?? null);
  return <SyncContext.Provider value={state}>{children}</SyncContext.Provider>;
}

export function useSyncState() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncState must be inside SyncProvider');
  return ctx;
}
