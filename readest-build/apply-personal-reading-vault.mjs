#!/usr/bin/env node
// Readest Personal v0.12.16: apply *after* existing personal patch series.
// Deliberately fails on upstream drift instead of silently breaking user notes.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'upstream');
const app = path.join(root, 'apps/readest-app');
const local = path.dirname(new URL(import.meta.url).pathname);
function patch(relative, before, after) {
  const file = path.join(app, relative);
  const original = fs.readFileSync(file, 'utf8');
  const count = original.split(before).length - 1;
  if (count !== 1) throw new Error('Reading vault patch expected one anchor (' + count + '): ' + relative + '\n' + before.slice(0, 100));
  fs.writeFileSync(file, original.replace(before, after));
}
function copy(source, dest) {
  const full = path.join(app, dest);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.copyFileSync(path.join(local, source), full);
}
copy('personalReadingVault.ts', 'src/utils/personalReadingVault.ts');
copy('PersonalReadingVault.tsx', 'src/components/PersonalReadingVault.tsx');
copy('personalReadingVault.test.ts', 'src/__tests__/personalReadingVault.test.ts');
copy('personalLayoutBackup.test.ts', 'src/__tests__/personalLayoutBackup.test.ts');

// Use the existing draggable/reorderable selection-toolbar configuration,
// rather than creating a second, uncontrolled popup.
patch('src/types/annotator.ts',
  "  | 'dictionary'\n  | 'translate'",
  "  | 'dictionary'\n  | 'wordbook'\n  | 'translate'");
patch('src/utils/annotationToolbar.ts',
  "  'dictionary',\n  'translate',\n  'tts',\n  'proofread',\n  'share',",
  "  'dictionary',\n  'wordbook',\n  'translate',\n  'tts',\n  'proofread',\n  'share',");
patch('src/utils/annotationToolbar.ts',
  "export const DEFAULT_ANNOTATION_TOOLBAR_ITEMS: AnnotationToolType[] = [\n  'copy',\n  'highlight',\n  'annotate',\n  'search',\n  'dictionary',",
  "export const DEFAULT_ANNOTATION_TOOLBAR_ITEMS: AnnotationToolType[] = [\n  'copy',\n  'highlight',\n  'annotate',\n  'search',\n  'dictionary',\n  'wordbook',");
patch('src/app/reader/components/annotator/AnnotationTools.tsx',
  "import { LuBookA } from 'react-icons/lu';",
  "import { LuBookA } from 'react-icons/lu';\nimport { MdOutlineLibraryAdd } from 'react-icons/md';");
patch('src/app/reader/components/annotator/AnnotationTools.tsx',
  "  {\n    type: 'translate',",
  "  {\n    type: 'wordbook',\n    label: '단어장에 추가',\n    tooltip: '선택한 단어를 책 전체 공통 단어장에 저장',\n    Icon: MdOutlineLibraryAdd,\n    quickAction: true,\n  },\n  {\n    type: 'translate',");
patch('src/app/reader/components/annotator/Annotator.tsx',
  "import { eventDispatcher } from '@/utils/event';",
  "import { eventDispatcher } from '@/utils/event';\nimport { saveReadingVaultEntry } from '@/utils/personalReadingVault';");
patch('src/app/reader/components/annotator/Annotator.tsx',
  "      case 'translate':\n        return { tooltipText: _(label), Icon, onClick: handleTranslation };",
  `      case 'translate':
        return { tooltipText: _(label), Icon, onClick: handleTranslation };
      case 'wordbook':
        return { tooltipText: '단어장에 추가', Icon, onClick: () => {
          try {
            if (!selection?.text) throw new Error('텍스트를 선택하세요.');
            saveReadingVaultEntry({
              kind: 'word', text: selection.text,
              bookId: bookData.book?.hash ?? bookKey.split('-')[0] ?? '',
              bookTitle: bookData.book?.title ?? '제목 없음',
              quote: selection.text,
              cfi: selection.cfi,
            });
            eventDispatcher.dispatch('toast', { type: 'success',
              message: '통합 단어장에 저장했습니다.', timeout: 2000 });
            handleDismissPopupAndSelection();
          } catch (error) {
            eventDispatcher.dispatch('toast', { type: 'error',
              message: error instanceof Error ? error.message : String(error), timeout: 4000 });
          }
        }};
`);

// Keep upstream toolbar regression coverage aligned with the new action.
patch('src/__tests__/utils/annotationToolbar.test.ts',
  "  test('default toolbar is the eight non-share tools in canonical order', () => {",
  "  test('default toolbar includes cross-book vocabulary in canonical order', () => {");
patch('src/__tests__/utils/annotationToolbar.test.ts',
  "expect(DEFAULT_ANNOTATION_TOOLBAR_ITEMS).toEqual([\n      'copy',\n      'highlight',\n      'annotate',\n      'search',\n      'dictionary',\n      'translate',",
  "expect(DEFAULT_ANNOTATION_TOOLBAR_ITEMS).toEqual([\n      'copy',\n      'highlight',\n      'annotate',\n      'search',\n      'dictionary',\n      'wordbook',\n      'translate',");
patch('src/__tests__/utils/annotationToolbar.test.ts',
  "expect(getAvailableToolTypes(['copy'], true)).toEqual([\n      'copylink',\n      'highlight',\n      'annotate',\n      'search',\n      'dictionary',\n      'translate',",
  "expect(getAvailableToolTypes(['copy'], true)).toEqual([\n      'copylink',\n      'highlight',\n      'annotate',\n      'search',\n      'dictionary',\n      'wordbook',\n      'translate',");

// Accessible book-specific notes tab, placed strictly between annotations and bookmarks.
patch('src/app/reader/components/sidebar/TabNavigation.tsx',
  "import { PiNotePencil } from 'react-icons/pi';",
  "import { PiNotePencil } from 'react-icons/pi';\nimport { LuNotebookPen } from 'react-icons/lu';");
patch('src/app/reader/components/sidebar/TabNavigation.tsx',
  "  const tabs = ['toc', 'annotations', 'bookmarks',",
  "  const tabs = ['toc', 'annotations', 'personal-notes', 'bookmarks',");
patch('src/app/reader/components/sidebar/TabNavigation.tsx',
  "      case 'bookmarks':\n        return _('Bookmark');",
  "      case 'personal-notes':\n        return '독서 노트';\n      case 'bookmarks':\n        return _('Bookmark');");
patch('src/app/reader/components/sidebar/TabNavigation.tsx',
  "            ) : tab === 'bookmarks' ? (",
  "            ) : tab === 'personal-notes' ? (\n              <LuNotebookPen className='mx-auto' />\n            ) : tab === 'bookmarks' ? (");
patch('src/app/reader/components/sidebar/Content.tsx',
  "import BooknoteView from './BooknoteView';",
  "import BooknoteView from './BooknoteView';\nimport { PersonalReadingVaultPanel } from '@/components/PersonalReadingVault';");
patch('src/app/reader/components/sidebar/Content.tsx',
  "              {targetTab === 'bookmarks' && (",
  "              {targetTab === 'personal-notes' && (\n                <PersonalReadingVaultPanel mode='note' bookId={sideBarBookKey.split('-')[0]} />\n              )}\n              {targetTab === 'bookmarks' && (");

// The library hamburger menu is available while signed out; both lists must
// remain local-first and cannot depend on a Readest cloud account.
patch('src/app/library/components/SettingsMenu.tsx',
  "import Menu from '@/components/Menu';",
  "import Menu from '@/components/Menu';\nimport { MdOutlineLibraryBooks, MdOutlineSpeakerNotes } from 'react-icons/md';");
patch('src/app/library/components/SettingsMenu.tsx',
  "      <MenuItem\n        label={themeModeLabel}",
  `      <MenuItem
        label='통합 단어장' Icon={MdOutlineLibraryBooks}
        onClick={() => {
          window.dispatchEvent(new CustomEvent('readest-personal-open-vault', { detail: {mode: 'word'} }));
          setIsDropdownOpen?.(false);
        }}
      />
      <MenuItem
        label='모든 독서 노트' Icon={MdOutlineSpeakerNotes}
        onClick={() => {
          window.dispatchEvent(new CustomEvent('readest-personal-open-vault', { detail: {mode: 'note'} }));
          setIsDropdownOpen?.(false);
        }}
      />
      <MenuItem
        label={themeModeLabel}`);
patch('src/app/library/components/LibraryHeader.tsx',
  "import SettingsMenu from './SettingsMenu';",
  "import SettingsMenu from './SettingsMenu';\nimport { PersonalReadingVaultPortal } from '@/components/PersonalReadingVault';");
patch('src/app/library/components/LibraryHeader.tsx',
  "      <div className='flex w-full items-center justify-between space-x-6 sm:space-x-12'>",
  "      <PersonalReadingVaultPortal />\n      <div className='flex w-full items-center justify-between space-x-6 sm:space-x-12'>");

// Prime page audio while the reader is open, rather than allocating the
// HTMLAudioElement on the first actual page turn. This only reduces startup
// latency; it deliberately does not alter the relocation-to-turn classifier.
patch('src/components/settings/PersonalPageTurnSound.tsx',
  "export function playPageSound(config?:PageSoundConfig,force=false){",
  `export function primePageSound(config:PageSoundConfig) {
 const source=assetSource(config);
 if(soundSources.has(source))return;
 try {
  const audio=new Audio(source);
  audio.preload='auto';
  soundSources.set(source,audio);
  audio.load();
 } catch (error) { console.debug('Paper audio preload unavailable',error); }
}
export function playPageSound(config?:PageSoundConfig,force=false){`);
patch('src/components/settings/PersonalPageTurnSound.tsx',
  " const view=useReaderStore(s=>s.getView(bookKey));",
  ` const view=useReaderStore(s=>s.getView(bookKey));
 useEffect(()=>{
  if(monitor && config.enabled)primePageSound(config);
 },[monitor,config.enabled,config.selected]);`);

// The selective backup originally included localStorage CSS and sound presets,
// but not cross-book vocabulary/notes. Include the data with the same category
// flags and merge on restore (newer edits win), never erase the other category.
const backup='src/utils/personalBackupSelection.ts';
patch(backup,
  "import type { SystemSettings } from '@/types/settings';",
  "import type { SystemSettings } from '@/types/settings';\nimport { READING_VAULT_KEY, readReadingVault, mergeReadingVaultBackup } from '@/utils/personalReadingVault';");
patch(backup,
  "  'readest-personal-ai-templates-v1',",
  "  'readest-personal-ai-templates-v1',\n  READING_VAULT_KEY,");
patch(backup,
  "  for (const key of PERSONAL_KEYS) {\n    if (key.includes('css-profiles') ? !choice.css :\n        key.includes('page-sounds')",
  `  for (const key of PERSONAL_KEYS) {
    if (key === READING_VAULT_KEY) {
      if (choice.notes || choice.appSettings) {
        const entries = readReadingVault().filter(e => e.kind === 'note' ? choice.notes : choice.appSettings);
        result[key] = JSON.stringify({version: 1, entries});
      }
      continue;
    }
    if (key.includes('css-profiles') ? !choice.css :
        key.includes('page-sounds')`);
patch(backup,
  "  for (const key of PERSONAL_KEYS) {\n    if (key.includes('css-profiles') ? !choice.css : !choice.appSettings) continue;",
  `  for (const key of PERSONAL_KEYS) {
    if (key === READING_VAULT_KEY) {
      const snapshot = stored[key];
      if (typeof snapshot === 'string' && (choice.notes || choice.appSettings))
        mergeReadingVaultBackup(snapshot);
      continue;
    }
    if (key.includes('css-profiles') ? !choice.css : !choice.appSettings) continue;`);
console.log('Readest Personal: cross-book vocabulary, notes, selection toolbar, sidebar, hamburger entries and ZIP backup installed');
