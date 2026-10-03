import { type Href, router } from 'expo-router';

/** Go back, or to a sensible home when this screen was the entry point (deep link, notification). */
export function backOr(fallback: Href = '/(tabs)/diary') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
