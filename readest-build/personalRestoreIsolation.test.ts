import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PERSONAL_BACKUP,
  importPersonalLocalStorage,
  exportPersonalLocalStorage,
  mergePersonalBookConfig,
  filterPersonalSettings,
} from '@/utils/personalBackupSelection';
import {
  READING_VAULT_KEY,
  readReadingVault,
  saveReadingVaultEntry,
} from '@/utils/personalReadingVault';
import type { SystemSettings } from '@/types/settings';

beforeEach(() => localStorage.clear());
describe('actual selective restore state', () => {
  it('notes-only restore cannot import words from an untrusted mixed snapshot', () => {
    const word = saveReadingVaultEntry({ kind: 'word', text: 'word', bookId: 'a', bookTitle: 'A' });
    const note = saveReadingVaultEntry({ kind: 'note', text: 'note', bookId: 'a', bookTitle: 'A' });
    const snapshot = JSON.stringify({ version: 1, entries: [word, note] });
    localStorage.clear();
    importPersonalLocalStorage(
      { [READING_VAULT_KEY]: snapshot },
      { ...DEFAULT_PERSONAL_BACKUP, appSettings: false, notes: true },
    );
    expect(readReadingVault().map((e) => e.kind)).toEqual(['note']);
  });
  it('words-only import keeps local notes and excludes backup notes', () => {
    const word = saveReadingVaultEntry({ kind: 'word', text: 'word', bookId: 'a', bookTitle: 'A' });
    const note = saveReadingVaultEntry({
      kind: 'note',
      text: 'backup note',
      bookId: 'a',
      bookTitle: 'A',
    });
    localStorage.clear();
    saveReadingVaultEntry({ kind: 'note', text: 'local note', bookId: 'a', bookTitle: 'A' });
    importPersonalLocalStorage(
      { [READING_VAULT_KEY]: JSON.stringify({ version: 1, entries: [word, note] }) },
      { ...DEFAULT_PERSONAL_BACKUP, appSettings: true, notes: false },
    );
    expect(
      readReadingVault()
        .map((e) => e.text)
        .sort(),
    ).toEqual(['local note', 'word']);
  });
  it('CSS-only settings snapshot keeps CSS even with appSettings enabled and layouts disabled', () => {
    const result = filterPersonalSettings(
      {
        globalViewSettings: { marginLeftPx: 40, userStylesheet: 'p {color:red}' },
      } as unknown as SystemSettings,
      { ...DEFAULT_PERSONAL_BACKUP, appSettings: true, layouts: false, css: true },
    );
    expect(result.globalViewSettings).toEqual({ userStylesheet: 'p {color:red}' });
  });
  it('CSS-only book import cannot modify margins or toolbar from an overbroad snapshot', () => {
    const restored = mergePersonalBookConfig(
      { viewSettings: { marginLeftPx: 19, userStylesheet: 'old' } },
      { viewSettings: { marginLeftPx: 80, userStylesheet: 'new' } },
      { ...DEFAULT_PERSONAL_BACKUP, layouts: false, css: true },
    );
    expect(restored.viewSettings).toMatchObject({ marginLeftPx: 19, userStylesheet: 'new' });
  });
  it('exports, clears and restores media plus selected vault entries to actual storage', () => {
    localStorage.setItem(
      'readest-personal-page-sounds-v1',
      JSON.stringify({ enabled: true, volume: 31, selected: 'soft' }),
    );
    saveReadingVaultEntry({ kind: 'word', text: '의지', bookId: 'a', bookTitle: 'A' });
    const snapshot = exportPersonalLocalStorage(DEFAULT_PERSONAL_BACKUP);
    localStorage.clear();
    importPersonalLocalStorage(snapshot, DEFAULT_PERSONAL_BACKUP);
    expect(JSON.parse(localStorage.getItem('readest-personal-page-sounds-v1')!)).toMatchObject({
      volume: 31,
      selected: 'soft',
    });
    expect(readReadingVault()[0]?.text).toBe('의지');
  });
});
