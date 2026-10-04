import { parseSummary, summaryUrl } from '@/lib/wiki';

describe('wiki', () => {
  it('builds the summary URL from a scientific name', () => {
    expect(summaryUrl('Turdus migratorius')).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Turdus_migratorius');
  });
  it('keeps the fields a species account needs', () => {
    const s = parseSummary({ type: 'standard', title: 'American robin', extract: ' A migratory bird. ', thumbnail: { source: 'https://x/y.jpg' }, content_urls: { mobile: { page: 'https://en.m.wikipedia.org/wiki/American_robin' } } });
    expect(s).toEqual({ title: 'American robin', extract: 'A migratory bird.', thumbnail: 'https://x/y.jpg', url: 'https://en.m.wikipedia.org/wiki/American_robin' });
  });
  it('rejects disambiguation pages and empty extracts', () => {
    expect(parseSummary({ type: 'disambiguation', title: 'Robin', extract: 'Robin may refer to' })).toBeNull();
    expect(parseSummary({ title: 'X', extract: '' })).toBeNull();
    expect(parseSummary(null)).toBeNull();
  });
});
