import { cachedPhotoUrl, invalidatePhotoUrl, isDirectUri, signPhotoUrls } from '@/lib/photos';

const mockCreateSignedUrls = jest.fn();
jest.mock('@/lib/supabase', () => ({
  PHOTO_BUCKET: 'sighting-photos',
  supabase: { storage: { from: () => ({ createSignedUrls: mockCreateSignedUrls }) } },
}));


describe('photo url cache', () => {
  beforeEach(() => mockCreateSignedUrls.mockReset());

  it('passes local files and allow-listed urls through, nothing else', () => {
    expect(isDirectUri('file:///a.jpg')).toBe(true);
    expect(isDirectUri('https://images.unsplash.com/photo-1')).toBe(true);
    expect(isDirectUri('https://x/y.jpg')).toBe(false); // arbitrary hosts are never fetched
    expect(isDirectUri('data:image/png;base64,AAAA')).toBe(false);
    expect(cachedPhotoUrl('https://images.unsplash.com/photo-1')).toBe('https://images.unsplash.com/photo-1');
    expect(cachedPhotoUrl(null)).toBeNull();
  });

  it('signs storage paths in one batch and caches them', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: [{ path: 'u/a.jpg', signedUrl: 'https://s/a' }, { path: 'u/b.jpg', signedUrl: 'https://s/b' }], error: null });
    expect(cachedPhotoUrl('u/a.jpg')).toBeNull();
    await signPhotoUrls(['u/a.jpg', 'u/b.jpg', 'u/a.jpg', null, 'https://images.unsplash.com/direct']);
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrls.mock.calls[0][0]).toEqual(['u/a.jpg', 'u/b.jpg']);
    expect(cachedPhotoUrl('u/a.jpg')).toBe('https://s/a');
    await signPhotoUrls(['u/a.jpg']);
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1); // cached, no new request
  });

  it('forgets invalidated paths and survives signing errors', async () => {
    invalidatePhotoUrl('u/a.jpg');
    expect(cachedPhotoUrl('u/a.jpg')).toBeNull();
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: { message: 'nope' } });
    await expect(signPhotoUrls(['u/a.jpg'])).resolves.toBeUndefined();
    expect(cachedPhotoUrl('u/a.jpg')).toBeNull();
  });
});
