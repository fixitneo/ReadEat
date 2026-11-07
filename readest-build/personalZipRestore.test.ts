// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZipWriter, Uint8ArrayWriter } from '@zip.js/zip.js';
import { addBackupEntriesToZip, restoreFromBackupZip } from '@/services/backupService';
import { DEFAULT_PERSONAL_BACKUP } from '@/utils/personalBackupSelection';
import { readReadingVault, saveReadingVaultEntry } from '@/utils/personalReadingVault';
import type { AppService } from '@/types/system';
import type { Book, BookConfig } from '@/types/book';
import type { SystemSettings } from '@/types/settings';
vi.mock(import('@/services/environment'), async (original) => ({
  ...(await original()),
  isTauriAppPlatform: () => false,
}));
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('real ZIP export -> changed destination -> restore', () => {
  it('restores four margins, compact layout, toolbar, WebGL, audio, words and notes to destination data', async () => {
    const hash = 'a'.repeat(32);
    const book: Book = {
      hash,
      format: 'EPUB',
      title: 'Fixture',
      author: 'QA',
      createdAt: 1,
      updatedAt: 2,
    };
    const view = {
      marginLeftPx: 40,
      marginRightPx: 41,
      marginTopPx: 50,
      marginBottomPx: 51,
      compactMarginLeftPx: 9,
      compactMarginRightPx: 10,
      compactMarginTopPx: 11,
      compactMarginBottomPx: 12,
      isGlobal: false,
      pageTurnStyle: 'curl',
      personalPageCurl: 'google',
      personalPageTurnMs: 325,
      annotationToolbarItems: ['wordbook', 'dictionary', 'highlight'],
      personalDictionary2: 'google-translate',
      backgroundTextureId: 'none',
      userStylesheet: 'p { line-height: 1.5 }',
    };
    let settings = {
      version: 1,
      globalViewSettings: { ...view, isGlobal: true },
      globalReadSettings: {},
      personalProfile: { pageSounds: { enabled: true, selected: 'soft', volume: 31, files: [] } },
    } as unknown as SystemSettings;
    const files = new Map<string, string>([
      [hash + '/config.json', JSON.stringify({ viewSettings: view, updatedAt: 2 })],
    ]);
    const service = {
      loadLibraryBooks: async () => [book],
      saveLibraryBooks: async () => {},
      loadSettings: async () => structuredClone(settings),
      saveSettings: async (value: SystemSettings) => {
        settings = structuredClone(value);
      },
      resolveFilePath: async () => '/Books',
      readDirectory: async () => [...files].map(([path, value]) => ({ path, size: value.length })),
      readFile: async (path: string) => {
        if (!files.has(path)) throw Error('missing ' + path);
        return files.get(path)!;
      },
      writeFile: async (path: string, _base: string, value: string | ArrayBuffer) => {
        files.set(path, typeof value === 'string' ? value : new TextDecoder().decode(value));
      },
      exists: async () => true,
      createDir: async () => {},
    } as unknown as AppService;
    saveReadingVaultEntry({ kind: 'word', text: '의지', bookId: hash, bookTitle: 'Fixture' });
    saveReadingVaultEntry({
      kind: 'note',
      text: '독서 노트',
      bookId: hash,
      bookTitle: 'Fixture',
      memo: '기록',
    });
    localStorage.setItem(
      'readest-personal-page-sounds-v1',
      JSON.stringify({ enabled: true, selected: 'soft', volume: 31 }),
    );
    const writer = new ZipWriter(new Uint8ArrayWriter(), {
      useWebWorkers: false,
      useCompressionStream: false,
      level: 0,
    });
    await addBackupEntriesToZip(writer, service, {
      selection: { ...DEFAULT_PERSONAL_BACKUP, bookFiles: false, statistics: false },
    });
    const bytes = await writer.close();
    files.set(
      hash + '/config.json',
      JSON.stringify({ viewSettings: { marginLeftPx: 1, marginTopPx: 2 }, updatedAt: 999 }),
    );
    settings = {
      ...settings,
      globalViewSettings: { ...settings.globalViewSettings, marginLeftPx: 1 },
    };
    localStorage.removeItem('readest-personal-reading-vault-v1');
    localStorage.removeItem('readest-personal-page-sounds-v1');
    const result = await restoreFromBackupZip(service, new Blob([new Uint8Array(bytes)]));
    expect(result).toMatchObject({ booksUpdated: 1, settingsRestored: true });
    const restored = JSON.parse(files.get(hash + '/config.json')!) as BookConfig;
    expect(restored.viewSettings).toMatchObject(view);
    expect((await service.loadSettings()).globalViewSettings).toMatchObject({
      ...view,
      isGlobal: true,
    });
    expect((await service.loadSettings()).personalProfile?.pageSounds).toMatchObject({
      volume: 31,
      selected: 'soft',
    });
    expect(
      readReadingVault()
        .map((entry) => entry.kind)
        .sort(),
    ).toEqual(['note', 'word']);
    expect(JSON.parse(localStorage.getItem('readest-personal-page-sounds-v1')!)).toMatchObject({
      volume: 31,
    });
  });
});
