import { describe, it, expect } from 'vitest';
import { normalizeAnnotationTags } from '@/app/reader/components/annotator/PersonalAnnotationTagPicker';
import { mergeNotes } from '@/services/sync/file/merge';
import { buildAnnotationExport } from '@/services/annotation/providers/readest';
import type { BookNote, BooknoteGroup } from '@/types/book';

const note = (overrides: Partial<BookNote> = {}): BookNote => ({
  id: 'note-a', type: 'annotation', cfi: 'epubcfi(/6/2)', text: 'Highlighted passage',
  note: '', createdAt: 100, updatedAt: 200, ...overrides,
});

describe('Personal annotation tags: validation and persistence', () => {
  it('normalizes whitespace and eliminates case-insensitive duplicates', () => {
    expect(normalizeAnnotationTags(['  Idea ', 'idea', 'To   Read', '', 42, 'Research']))
      .toEqual(['Idea', 'To Read', 'Research']);
  });
  it('rejects control characters, too-long names, and oversized per-annotation catalogs', () => {
    const many = Array.from({ length: 50 }, (_, i) => 'tag-' + i);
    expect(normalizeAnnotationTags(['abc\u0001', 'x'.repeat(41), ...many]).length).toBe(24);
    expect(normalizeAnnotationTags(many, 100).length).toBe(50);
  });
  it('keeps tags through per-note newer-wins synchronization', () => {
    const old = note({ tags: ['old'], updatedAt: 200 });
    const next = note({ tags: ['new', 'topic'], updatedAt: 300 });
    expect(mergeNotes([old], [next]).find((n) => n.id === 'note-a')?.tags)
      .toEqual(['new', 'topic']);
  });
  it('exports multi-tags alongside annotation text and style', () => {
    const item = note({ tags: ['topic', 'quote'], style: 'highlight', color: 'yellow' });
    const group: BooknoteGroup = { id: 0, href: '/chapter', label: 'Chapter', booknotes: [item] };
    const result = buildAnnotationExport({
      book: { title: 'Test Book', author: 'Test Author' }, groups: [group], exportedAt: 1234,
    });
    expect(result.annotations[0]?.tags).toEqual(['topic', 'quote']);
  });
});
