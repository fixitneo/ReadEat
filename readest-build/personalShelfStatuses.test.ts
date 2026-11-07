import {describe, it, expect} from 'vitest';
import type {Book} from '@/types/book';
import {
  DEFAULT_STATUS_ORDER, FAVORITE_TAG, WRITING_TAG,
  appendCustomStatus, catalogItems, matchesPersonalStatus,
  readStatusCatalog, removeCustomStatus, reorderStatuses,
  mergeCatalogWithBookTags,
} from '@/utils/personalShelfStatuses';

const book = (parts: Partial<Book> = {}): Book => ({
  hash: 'a', title: 'sample', author: 'author', format: 'EPUB',
  createdAt: 1, updatedAt: 2, ...parts,
} as Book);

describe('Readest Personal shared bookshelf status catalog', () => {
  it('keeps all built-in categories, including protected writing status', () => {
    const catalog = readStatusCatalog(null);
    expect(catalog.order).toEqual(DEFAULT_STATUS_ORDER);
    expect(catalogItems(catalog).filter(x => x.required).map(x => x.id)).toContain('writing');
    expect(removeCustomStatus(catalog, 'writing')).toEqual(catalog);
    expect(removeCustomStatus(catalog, 'favorites')).toEqual(catalog);
  });
  it('shares order with persisted JSON and supports draggable arbitrary reordering', () => {
    const start = appendCustomStatus(readStatusCatalog(null), '논문 정리');
    const moved = reorderStatuses(start, 'custom:논문 정리', 'reading');
    const restored = readStatusCatalog(JSON.stringify(moved));
    expect(restored.order.indexOf('custom:논문 정리')).toBe(restored.order.indexOf('reading') - 1);
    expect(restored.order).toHaveLength(DEFAULT_STATUS_ORDER.length + 1);
    expect(restored.custom).toContain('논문 정리');
  });
  it('adds an already assigned custom tag back after upgrading from previous versions', () => {
    const catalog = mergeCatalogWithBookTags(readStatusCatalog(null),
      [book({tags: ['ReadestStatus:논문 정리', FAVORITE_TAG]})]);
    expect(catalogItems(catalog).some(x => x.label === '논문 정리')).toBe(true);
    expect(matchesPersonalStatus(book({tags: ['ReadestStatus:논문 정리']}), 'custom:논문 정리')).toBe(true);
  });
  it('distinguishes native progress and custom/writing status, with favorites independent', () => {
    const writing = book({readingStatus: 'reading', tags: [WRITING_TAG, FAVORITE_TAG]});
    expect(matchesPersonalStatus(writing, 'writing')).toBe(true);
    expect(matchesPersonalStatus(writing, 'favorites')).toBe(true);
    expect(matchesPersonalStatus(writing, 'reading')).toBe(false);
    expect(matchesPersonalStatus(book({progress: [11, 100]}), 'read')).toBe(true);
    expect(matchesPersonalStatus(book({readingStatus: 'finished'}), 'finished')).toBe(true);
    expect(matchesPersonalStatus(book(), 'unread')).toBe(true);
    const reset = book({readingStatus: 'unread', progress: [50,100]});
    expect(matchesPersonalStatus(reset, 'unread')).toBe(true);
    expect(matchesPersonalStatus(reset, 'reading')).toBe(false);
    expect(matchesPersonalStatus(reset, 'read')).toBe(false);
  });
  it('rejects reserved labels, malformed records and duplicate custom labels', () => {
    expect(() => appendCustomStatus(readStatusCatalog(null), '작성 중')).toThrow();
    expect(() => appendCustomStatus(readStatusCatalog(null), '완독')).toThrow();
    const single = appendCustomStatus(readStatusCatalog(null), '교정');
    expect(appendCustomStatus(single, '교정')).toEqual(single);
    expect(readStatusCatalog('INVALID').order).toEqual(DEFAULT_STATUS_ORDER);
    expect(removeCustomStatus(single, 'custom:교정').custom).toEqual([]);
  });
});
