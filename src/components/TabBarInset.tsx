import React, { createContext, useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of a floating (absolute) tab bar covering screen content; 0 when the bar takes its own space. */
export const TabBarInsetContext = createContext(0);

/** Bottom padding a scrolling screen needs to clear both the home indicator and a floating tab bar. */
export function useBottomPadding(extra = 24): number {
  const insets = useSafeAreaInsets();
  const tab = useContext(TabBarInsetContext);
  return Math.max(insets.bottom, tab) + extra;
}

export function TabBarInsetProvider({ height, children }: { height: number; children: React.ReactNode }) {
  return <TabBarInsetContext.Provider value={height}>{children}</TabBarInsetContext.Provider>;
}
