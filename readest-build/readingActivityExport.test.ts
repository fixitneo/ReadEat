import { describe, expect, it, vi } from 'vitest';
import {
  makeReadingActivitySnapshot,
  publishReadingActivity,
  type ReadingActivityRecord,
} from '@/utils/readingActivityExport';
import type { FileSyncProvider } from '@/services/sync/file/provider';
const highlight: ReadingActivityRecord = {
  id: 'book-a:highlight:1',
  bookId: 'book-a',
  kind: 'highlight',
  text: 'Selected passage',
  createdAt: 100,
  updatedAt: 100,
};
describe('external reading activity feed', () => {
  it('exports only activity fields, never secrets, local paths or original book files', () => {
    const source = {
      ...highlight,
      password: 'secret',
      apiKey: 'secret',
      filePath: '/private/book.epub',
      location: { cfi: 'epubcfi(x)', token: 'secret' },
    };
    const json = JSON.stringify(makeReadingActivitySnapshot('device-a', [source], 200));
    expect(json).toContain('Selected passage');
    expect(json).not.toMatch(/secret|filePath|epub$/);
    expect(JSON.parse(json).records[0].location).toEqual({ cfi: 'epubcfi(x)' });
  });
  it('preserves deletions across missed polls without retaining deleted quote contents', () => {
    const a = makeReadingActivitySnapshot('device-a', [highlight], 200);
    const b = makeReadingActivitySnapshot('device-a', [], 300, a);
    expect(b.records[0]).toMatchObject({ id: highlight.id, deletedAt: 300 });
    expect(b.records[0]?.text).toBeUndefined();
    expect(makeReadingActivitySnapshot('device-a', [], 400, b).records[0]?.deletedAt).toBe(300);
  });
  it('does not publish an incomplete generation as latest', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(Error('offline'));
    const provider = {
      rootPath: '/private',
      ensureDir: vi.fn(),
      writeText,
    } as unknown as FileSyncProvider;
    await expect(
      publishReadingActivity(provider, makeReadingActivitySnapshot('device-a', [highlight], 200)),
    ).rejects.toThrow('offline');
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain('/generations/');
  });
  it('publishes the data before the per-device manifest without touching the sync database', async () => {
    const writeText = vi.fn();
    const provider = {
      rootPath: '/private',
      ensureDir: vi.fn(),
      writeText,
    } as unknown as FileSyncProvider;
    await publishReadingActivity(
      provider,
      makeReadingActivitySnapshot('device-a', [highlight], 200),
    );
    expect(writeText.mock.calls[0]?.[0]).toContain('/generations/');
    expect(writeText.mock.calls[1]?.[0]).toBe(
      '/private/reading-activity/v1/devices/device-a/manifest.json',
    );
    expect(JSON.parse(writeText.mock.calls[1]?.[1]).sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects traversal, ambiguous IDs and cross-device deletion inference', () => {
    expect(() => makeReadingActivitySnapshot('../other', [highlight], 200)).toThrow();
    expect(() => makeReadingActivitySnapshot('a', [highlight, highlight], 200)).toThrow();
    expect(() =>
      makeReadingActivitySnapshot('b', [], 300, makeReadingActivitySnapshot('a', [highlight], 200)),
    ).toThrow();
  });
});
