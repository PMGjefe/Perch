/** Sample photos are served at 1080px wide; cards never show more than ~700, so ask for less and decode less. */
export function sizedUri(uri: string): string {
  return uri.includes('images.unsplash.com') ? uri.replace(/([?&]w=)\d+/, '$1720') : uri;
}
