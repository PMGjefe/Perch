import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS !== 'web';
const quiet = (p: Promise<void>) => p.catch(() => {});

/** Small, consistent haptic vocabulary. Every call is fire-and-forget and safe on any platform. */
export const haptic = {
  tap: () => on && quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => on && quiet(Haptics.selectionAsync()),
  lift: () => on && quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => on && quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => on && quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** The lifer moment: a heavy thump followed by a success pattern. */
  celebrate: async () => {
    if (!on) return;
    await quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setTimeout(() => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 120);
  },
};
