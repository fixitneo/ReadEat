import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  READING_VAULT_KEY, readReadingVault, saveReadingVaultEntry, sortReadingVault,
  updateReadingVaultMemo, removeReadingVaultEntry, mergeReadingVaultBackup,
} from '@/utils/personalReadingVault';

describe('Readest Personal cross-book vault', () => {
  const memory = new Map<string, string>();
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    });
  });
  it('keeps words from two books without losing their sources', () => {
    saveReadingVaultEntry({kind: 'word', text: '사유', bookId: 'a', bookTitle: '첫 책'});
    saveReadingVaultEntry({kind: 'word', text: '사유', bookId: 'b', bookTitle: '둘째 책'});
    expect(readReadingVault()).toHaveLength(2);
    expect(readReadingVault().map(e => e.bookTitle).sort()).toEqual(['둘째 책', '첫 책'].sort());
  });
  it('deduplicates accidental re-selection in one book and retains memo', () => {
    const first = saveReadingVaultEntry({kind:'word',text:'Being',bookId:'a',bookTitle:'A',memo:'존재'});
    const second = saveReadingVaultEntry({kind:'word',text:'being',bookId:'a',bookTitle:'A'});
    expect(second.id).toBe(first.id);
    expect(second.memo).toBe('존재');
    expect(readReadingVault()).toHaveLength(1);
  });
  it('sorts Korean text by locale and dates in both directions', () => {
    const a = saveReadingVaultEntry({kind:'word',text:'나',bookId:'a',bookTitle:'A'});
    const b = saveReadingVaultEntry({kind:'word',text:'가',bookId:'a',bookTitle:'A'});
    const c = saveReadingVaultEntry({kind:'word',text:'다',bookId:'a',bookTitle:'A'});
    expect(sortReadingVault([a,c,b], 'az').map(e=>e.text)).toEqual(['가','나','다']);
    expect(sortReadingVault([a,c,b], 'new')).toHaveLength(3);
    expect(sortReadingVault([a,c,b], 'old')).toHaveLength(3);
  });
  it('preserves note and memo edits and removes only chosen ID', () => {
    const n = saveReadingVaultEntry({kind:'note',text:'노트 1',memo:'원문',bookId:'a',bookTitle:'A'});
    const w = saveReadingVaultEntry({kind:'word',text:'나비',bookId:'a',bookTitle:'A'});
    updateReadingVaultMemo(n.id,'수정');
    expect(readReadingVault().find(e=>e.id===n.id)?.memo).toBe('수정');
    removeReadingVaultEntry(w.id);
    expect(readReadingVault().map(e=>e.id)).toEqual([n.id]);
  });
  it('merges backups by ID without overwriting a newer local edit', () => {
    const a = saveReadingVaultEntry({kind:'word',text:'개념',memo:'현재',bookId:'a',bookTitle:'A'});
    mergeReadingVaultBackup(JSON.stringify({version:1,entries:[{...a,memo:'예전',updatedAt:a.updatedAt-100}]}));
    expect(readReadingVault()[0]?.memo).toBe('현재');
    const other = {...a,id:'other',text:'연구'};
    mergeReadingVaultBackup(JSON.stringify({version:1,entries:[other]}));
    expect(readReadingVault()).toHaveLength(2);
  });
  it('rejects corrupt storage without changing it', () => {
    memory.set(READING_VAULT_KEY,'{ broken');
    expect(() => saveReadingVaultEntry({kind:'note',text:'새 메모',bookId:'a',bookTitle:'A'})).toThrow();
    expect(memory.get(READING_VAULT_KEY)).toBe('{ broken');
  });
  it('fails on quota instead of falsely reporting saved data', () => {
    const old = memory.get(READING_VAULT_KEY);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
    });
    expect(() => saveReadingVaultEntry({kind:'word',text:'가',bookId:'a',bookTitle:'A'})).toThrow();
    expect(memory.get(READING_VAULT_KEY)).toBe(old);
  });
});
