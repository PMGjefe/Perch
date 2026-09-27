import type { MapStyleElement } from 'react-native-maps';

/** Google Maps night style for Android; iOS uses userInterfaceStyle. Muted, warm-neutral, no POI clutter. */
export const DARK_MAP: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1f1c17' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b3a897' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#15130f' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#23301f' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2620' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1f1c17' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1a22' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6170' }] },
];
