import type { ConfigContext, ExpoConfig } from 'expo/config';

import base from './app.json';

// app.json holds everything static; secrets come from the environment at build time.
export default ({ config }: ConfigContext): ExpoConfig => {
  const expo = { ...base.expo, ...config } as ExpoConfig;
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  expo.android = { ...expo.android, config: { ...expo.android?.config, googleMaps: key ? { apiKey: key } : undefined } };
  return expo;
};
