#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const app = path.resolve(process.argv[2] ?? 'upstream', 'apps/readest-app');
const local = path.dirname(new URL(import.meta.url).pathname);
function patch(name,oldText,newText) {
  const file=path.join(app,name),s=fs.readFileSync(file,'utf8');
  if(s.split(oldText).length!==2)throw new Error('Readest next feature patch mismatch: '+name+' '+oldText.slice(0,82));
  fs.writeFileSync(file,s.replace(oldText,newText));
}
// Replace source-code textareas with file-based stylesheet profiles; imports
// live on-device and never execute JavaScript or load remote resources.
fs.copyFileSync(path.join(local,'PersonalCSSFiles.tsx'),path.join(app,'src/components/settings/PersonalCSSFiles.tsx'));
const misc='src/components/settings/MiscPanel.tsx';
patch(misc,
  "import { BoxedList } from './primitives';",
  "import { BoxedList } from './primitives';\nimport { PersonalCSSFiles } from './PersonalCSSFiles';");
const cssFile=path.join(app,misc);
let css=fs.readFileSync(cssFile,'utf8');
const start=css.indexOf('          <textarea\n',css.indexOf('const renderCSSEditor ='));
const end=css.indexOf('          <button\n',start);
if(start<0||end<0)throw new Error('Could not locate CSS textarea');
css=css.slice(0,start)+
  "          <div className='hidden' aria-hidden='true'>\n"+
  css.slice(start,end)+
  "          </div>\n          <PersonalCSSFiles bookKey={bookKey} type={type} />\n"+
  css.slice(end);
fs.writeFileSync(cssFile,css);

// PDF source stays in memory only while a PDF is open, never converted or
// overwritten. The #PDF text-mode switch uses pdf.js's existing worker.
fs.copyFileSync(path.join(local,'personalPDFReflow.ts'),path.join(app,'src/utils/personalPDFReflow.ts'));
fs.copyFileSync(path.join(local,'PersonalPDFTextMode.tsx'),path.join(app,'src/app/reader/components/PersonalPDFTextMode.tsx'));
fs.copyFileSync(path.join(local,'personalPDFText.test.ts'),path.join(app,'src/__tests__/personalPDFText.test.ts'));
patch('src/libs/document.ts',
  "        book = await makePDF(this.file);\n        format = 'PDF';",
  "        book = await makePDF(this.file);\n        (book as typeof book & {personalPDFSource?:File}).personalPDFSource = this.file;\n        format = 'PDF';");
// Keep the original header toggle tappable above the PDF text overlay,
// including the unfolded Fold7 layout where the header is absolute.
patch('src/app/reader/components/HeaderBar.tsx',
  "        paddingTop: appService?.hasSafeAreaInset ? \`\${insets.top}px\` : '0px',",
  "        paddingTop: appService?.hasSafeAreaInset ? \`\${insets.top}px\` : '0px',\n" +
  "        zIndex: appService?.isAndroidApp ? 40 : undefined,");
patch('src/app/reader/components/HeaderBar.tsx',
  "import { MdOutlineMenu } from 'react-icons/md';",
  "import { MdOutlineMenu, MdOutlineArticle } from 'react-icons/md';\nimport { eventDispatcher } from '@/utils/event';");
patch('src/app/reader/components/HeaderBar.tsx',
  "          <NotebookToggler bookKey={bookKey} />",
  "          {bookData?.book?.format === 'PDF' && <button type='button'\n" +
  "            className='btn btn-ghost h-8 min-h-8 w-8 p-0' title='PDF / text mode'\n" +
  "            aria-label='Toggle PDF text reading mode'\n" +
  "            onClick={() => void eventDispatcher.dispatch('personal-pdf-mode-toggle', {bookKey})}>\n" +
  "            <MdOutlineArticle size={20} />\n" +
  "          </button>}\n" +
  "          <NotebookToggler bookKey={bookKey} />");
patch('src/app/reader/components/FoliateViewer.tsx',
  "import Spinner from '@/components/Spinner';",
  "import Spinner from '@/components/Spinner';\nimport { PersonalPDFTextMode } from './PersonalPDFTextMode';");
patch('src/app/reader/components/FoliateViewer.tsx',
  "      <ImageContextMenu bookKey={bookKey} />",
  "      {bookData?.book?.format === 'PDF' && <PersonalPDFTextMode bookKey={bookKey} bookDoc={bookDoc} />}\n" +
  "      <ImageContextMenu bookKey={bookKey} />");

// Attach sound settings to existing behavior settings, and hook sound events
// to Foliate's relocate event (tap, swipe, hardware key, footer, etc.).
fs.copyFileSync(path.join(local,'PersonalPageTurnSound.tsx'),path.join(app,'src/components/settings/PersonalPageTurnSound.tsx'));
fs.copyFileSync(path.join(local,'PersonalPageTurnSound.tsx'),path.join(app,'src/app/reader/components/PersonalPageTurnSound.tsx'));
patch('src/components/settings/ControlPanel.tsx',
  "import PageTurnerSettings from './PageTurnerSettings';",
  "import PageTurnerSettings from './PageTurnerSettings';\nimport { PersonalPageTurnSound } from './PersonalPageTurnSound';");
patch('src/components/settings/ControlPanel.tsx',
  "      <PageTurnerSettings\n        bookKey={bookKey}",
  "      <PersonalPageTurnSound bookKey={bookKey} />\n      <PageTurnerSettings\n        bookKey={bookKey}");
patch('src/app/reader/components/FoliateViewer.tsx',
  "import { PersonalPDFTextMode } from './PersonalPDFTextMode';",
  "import { PersonalPDFTextMode } from './PersonalPDFTextMode';\nimport { PersonalPageTurnSound } from './PersonalPageTurnSound';");
patch('src/app/reader/components/FoliateViewer.tsx',
  "      {bookData?.book?.format === 'PDF' && <PersonalPDFTextMode bookKey={bookKey} bookDoc={bookDoc} />}",
  "      <PersonalPageTurnSound bookKey={bookKey} monitor />\n      {bookData?.book?.format === 'PDF' && <PersonalPDFTextMode bookKey={bookKey} bookDoc={bookDoc} />}");

// Favorite star is a reserved book tag. This leverages Readest's existing
// metadata timestamp/merge and WebDAV sync rather than a device-local list.
// Reserved synced metadata tag for favorites.
patch('src/app/library/components/BookItem.tsx',
  "import { MdCheckCircle, MdCheckCircleOutline, MdOutlineOfflinePin } from 'react-icons/md';",
  "import { MdCheckCircle, MdCheckCircleOutline, MdOutlineOfflinePin, MdStar, MdStarBorder } from 'react-icons/md';\nimport { useLibraryStore } from '@/store/libraryStore';\nimport { applyBookTagEdits } from '../utils/libraryUtils';");
patch('src/app/library/components/BookItem.tsx',
  "  const { appService } = useEnv();",
  "  const { appService, envConfig } = useEnv();");
patch('src/app/library/components/BookItem.tsx',
  "  // One condition drives both the cover overlay",
  "  const isFavorite = (book.tags ?? []).includes('★ Favorites');\n" +
  "  const toggleFavorite = () => {\n" +
  "    const library = useLibraryStore.getState();\n" +
  "    const changed = applyBookTagEdits(library.library, [book.hash], {\n" +
  "      add: isFavorite ? [] : ['★ Favorites'], remove: isFavorite ? ['★ Favorites'] : [],\n" +
  "    }).find(b => b.hash === book.hash);\n" +
  "    if (changed) void library.updateBook(envConfig,changed);\n" +
  "  };\n" +
  "  // One condition drives both the cover overlay");
patch('src/app/library/components/BookItem.tsx',
  "        {isTransferring && (",
  "        <button type='button' aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}\n" +
  "          title={isFavorite ? 'Remove favorite' : 'Add favorite'} aria-pressed={isFavorite}\n" +
  "          className='absolute left-1 top-1 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-amber-300'\n" +
  "          onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}\n" +
  "          onClick={e => {e.preventDefault();e.stopPropagation();toggleFavorite();}}>\n" +
  "          {isFavorite ? <MdStar size={19}/> : <MdStarBorder size={19}/>}\n" +
  "        </button>\n" +
  "        {isTransferring && (");

// Allow arbitrary named book statuses by carrying a well-scoped metadata tag.
// Built-in reading status remains untouched and continues to function.
patch('src/app/library/components/SetStatusAlert.tsx',
  "    {\n      label: _('Mark as Finished'),",
  "    {\n      label: _('Mark as Reading'),\n" +
  "      status: 'reading' as ReadingStatus,\n" +
  "      className: 'not-eink:bg-blue-500/15 not-eink:text-blue-500 not-eink:border-blue-500/20 eink-bordered',\n" +
  "    },\n" +
  "    {\n      label: _('Mark as Finished'),");
patch('src/app/library/components/SetStatusAlert.tsx',
  "import { ReadingStatus } from '@/types/book';",
  "import { ReadingStatus } from '@/types/book';\nimport { useState } from 'react';\nimport { useEnv } from '@/context/EnvContext';\nimport { useLibraryStore } from '@/store/libraryStore';\nimport { applyBookTagEdits } from '../utils/libraryUtils';");
patch('src/app/library/components/SetStatusAlert.tsx',
  "  const statusButtons = [",
  "  const { envConfig } = useEnv();\n" +
  "  const [customStatus,setCustomStatus] = useState('');\n" +
  "  const savePersonalStatus = async () => {\n" +
  "    const value=customStatus.trim();\n" +
  "    if(!value || value.length>32)return;\n" +
  "    const store=useLibraryStore.getState();\n" +
  "    const selected=store.getSelectedBooks();\n" +
  "    const updates=selected.flatMap(hash => {\n" +
  "      const book=store.getBookByHash(hash);\n" +
  "      if(!book)return [];\n" +
  "      const previous=(book.tags??[]).filter(t=>t.startsWith('ReadestStatus:'));\n" +
  "      return applyBookTagEdits([book],[hash],{add:['ReadestStatus:'+value],remove:previous});\n" +
  "    });\n" +
  "    await store.updateBooks(envConfig,updates);\n" +
  "    onCancel();\n" +
  "  };\n" +
  "  const statusButtons = [");
patch('src/app/library/components/SetStatusAlert.tsx',
  "          {statusButtons.map(({ label, status, className }) => (",
  "          {statusButtons.map(({ label, status, className }) => (");
patch('src/app/library/components/SetStatusAlert.tsx',
  "          <button\n            className={clsx(\n              'hidden items-center gap-2 rounded-full border px-4 py-2',",
  "          <div className='flex w-full items-center gap-2'>\n" +
  "            <input aria-label='Custom reading status' maxLength={32} placeholder='Custom status…'\n" +
  "              className='input input-bordered min-w-0 flex-1' value={customStatus}\n" +
  "              onChange={e=>setCustomStatus(e.target.value)} />\n" +
  "            <button type='button' className='btn btn-primary btn-sm'\n" +
  "              disabled={!customStatus.trim()} onClick={() => void savePersonalStatus()}>+ Save status</button>\n" +
  "          </div>\n" +
  "          <button\n            className={clsx(\n              'hidden items-center gap-2 rounded-full border px-4 py-2',");

// The default quick-resume bookshelf is a carousel; expose a dropdown for
// reading, finished, favorites, never read, and the user's custom statuses.
patch('src/app/library/components/BookshelfStream.tsx',
  "import { bookshelfName } from '@/services/bookshelves/definitions';",
  "import { bookshelfName, RECENT_BOOKSHELF_ID } from '@/services/bookshelves/definitions';");
patch('src/app/library/components/BookshelfStream.tsx',
  "  sections: ShelfSection[];",
  "  sections: ShelfSection[];\n  allBooks?: Book[];");
patch('src/app/library/components/BookshelfStream.tsx',
  "  const _ = useTranslation();\n  const root = useRef<HTMLDivElement>(null);",
  "  const _ = useTranslation();\n  const [personalShelfFilter,setPersonalShelfFilter] = useState(() =>\n" +
  "    typeof window === 'undefined' ? 'recent' : localStorage.getItem('readest-personal-shelf-filter') || 'recent');\n" +
  "  const customStatuses = useMemo(() => Array.from(new Set((allBooks??[]).flatMap(b =>\n" +
  "    (b.tags??[]).filter(t => t.startsWith('ReadestStatus:')).map(t => t.slice(14)))))\n" +
  "    .sort((a,b)=>a.localeCompare(b)),[allBooks]);\n" +
  "  const adjustedSections = useMemo(() => sections.map(section => {\n" +
  "    if(section.definition.id !== RECENT_BOOKSHELF_ID || personalShelfFilter==='recent')return section;\n" +
  "    const matches = (allBooks??[]).filter(b => {\n" +
  "      if(b.deletedAt)return false;\n" +
  "      if(personalShelfFilter==='favorites')return (b.tags??[]).includes('★ Favorites');\n" +
  "      if(personalShelfFilter.startsWith('custom:'))return (b.tags??[]).includes('ReadestStatus:'+personalShelfFilter.slice(7));\n" +
  "      if(personalShelfFilter==='unread')return !b.progress?.[0] && (!b.readingStatus || b.readingStatus==='unread');\n" +
  "      if(personalShelfFilter==='reading')return b.readingStatus==='reading' || (!!b.progress?.[0] && b.readingStatus!=='finished' && b.readingStatus!=='abandoned');\n" +
  "      return b.readingStatus===personalShelfFilter;\n" +
  "    }).sort((a,b)=>(b.updatedAt??0)-(a.updatedAt??0));\n" +
  "    return {...section,items:matches};\n" +
  "  }),[sections,allBooks,personalShelfFilter]);\n" +
  "  const root = useRef<HTMLDivElement>(null);");
patch('src/app/library/components/BookshelfStream.tsx',
  "  const rows = useMemo(\n    () => buildBookshelfRows(sections, columns, includeImport),\n    [sections, columns, includeImport],",
  "  const rows = useMemo(\n    () => buildBookshelfRows(adjustedSections, columns, includeImport),\n    [adjustedSections, columns, includeImport],");
patch('src/app/library/components/BookshelfStream.tsx',
  "                    {name}\n                  </h2>",
  "                     {name}\n" +
  "                     {definition.id===RECENT_BOOKSHELF_ID&&<select className='select select-ghost select-xs ms-3'\n" +
  "                       value={personalShelfFilter} aria-label='Filter quick reading shelf'\n" +
  "                       onChange={e=>{setPersonalShelfFilter(e.target.value);localStorage.setItem('readest-personal-shelf-filter',e.target.value);}}>\n" +
  "                       <option value='recent'>Recently read</option>\n" +
  "                       <option value='reading'>Reading now</option>\n" +
  "                       <option value='unread'>Unread</option>\n" +
  "                       <option value='finished'>Finished</option>\n" +
  "                       <option value='abandoned'>On hold</option>\n" +
  "                       <option value='favorites'>★ Favorites</option>\n" +
  "                       {customStatuses.map(status=><option key={status} value={'custom:'+status}>{status}</option>)}\n" +
  "                     </select>}\n" +
  "                   </h2>");
patch('src/app/library/components/BookshelfStream.tsx',
  "export default function BookshelfStream({\n  sections,",
  "export default function BookshelfStream({\n  sections,\n  allBooks,");
patch('src/app/library/components/Bookshelf.tsx',
  "          <BookshelfStream\n            scrollKey=",
  "          <BookshelfStream\n            allBooks={visibleBooks}\n            scrollKey=");

fs.copyFileSync(path.join(local,'PersonalPDFOptions.tsx'),path.join(app,'src/components/settings/PersonalPDFOptions.tsx'));
patch('src/components/settings/ControlPanel.tsx',
  "import { PersonalPageTurnSound } from './PersonalPageTurnSound';",
  "import { PersonalPageTurnSound } from './PersonalPageTurnSound';\nimport { PersonalPDFOptions } from './PersonalPDFOptions';");
patch('src/components/settings/ControlPanel.tsx',
  "      <PersonalPageTurnSound bookKey={bookKey} />",
  "      <PersonalPDFOptions bookKey={bookKey} />\n      <PersonalPageTurnSound bookKey={bookKey} />");

// Android's system folder picker only picks one SAF tree per invocation;
// provide a multi-folder queue in ONE import dialog and import serially.
const folderDialog='src/app/library/components/ImportFromFolderDialog.tsx';
patch(folderDialog,
  "export interface ImportFromFolderResult {\n  directory: string;",
  "export interface ImportFromFolderResult {\n  directory: string;\n  directories?: string[];");
patch(folderDialog,
  "  const [directory, setDirectory] = useState(initialDirectory);",
  "  const [directory, setDirectory] = useState(initialDirectory);\n" +
  "  const [batchDirectories,setBatchDirectories] = useState<string[]>(() => initialDirectory ? [initialDirectory] : []);");
patch(folderDialog,
  "        setDirectory(picked);\n        // A different folder",
  "        setDirectory(picked);\n        setBatchDirectories([picked]);\n        // A different folder");
patch(folderDialog,
  "  const handleConfirm = () => {",
  "  const handlePickAdditional = async () => {\n" +
  "    if(picking)return;\n" +
  "    setPicking(true);\n" +
  "    try {\n" +
  "      const next=await onPickDirectory();\n" +
  "      if(next){setDirectory(next);setBatchDirectories(prev=>Array.from(new Set([...prev,next])));}\n" +
  "    } finally {setPicking(false);}\n" +
  "  };\n" +
  "  const handleConfirm = () => {");
patch(folderDialog,
  "    onConfirm({\n      directory,\n      extensions:",
  "    onConfirm({\n      directory,\n      directories: Array.from(new Set([...batchDirectories,directory])),\n      extensions:");
patch(folderDialog,
  "        {/* Format checkboxes — laid out as a 2-column grid so 6 entries",
  "        <div className='space-y-2'>\n" +
  "          <button type='button' className='btn btn-outline btn-sm w-full' disabled={picking}\n" +
  "            onClick={() => void handlePickAdditional()}>\n" +
  "            + Add another watched folder ({batchDirectories.length})\n" +
  "          </button>\n" +
  "          {batchDirectories.length>1 && <div className='max-h-32 space-y-1 overflow-y-auto'>\n" +
  "            {batchDirectories.map(path=><div className='flex items-center gap-2 text-xs' key={path}>\n" +
  "              <span className='min-w-0 flex-1 truncate'>{path}</span>\n" +
  "              <button type='button' aria-label={'Remove folder '+path} className='btn btn-ghost btn-xs'\n" +
  "                onClick={()=>setBatchDirectories(prev=>prev.filter(v=>v!==path))}>×</button>\n" +
  "            </div>)}\n" +
  "          </div>}\n" +
  "        </div>\n" +
  "        {/* Format checkboxes — laid out as a 2-column grid so 6 entries");
patch('src/app/library/page.tsx',
  "  const runFolderImport = async (result: ImportFromFolderResult) => {",
  "  const runFolderImport = async (result: ImportFromFolderResult): Promise<void> => {\n" +
  "    // The file importer queues runs and serializes them to avoid library races.\n" +
  "    const folders=Array.from(new Set(result.directories??[])).filter(Boolean);\n" +
  "    if(folders.length>1){\n" +
  "      for(const directory of folders) await runFolderImport({...result,directory,directories:undefined});\n" +
  "      return;\n" +
  "    }");
console.log('Readest Personal: CSS file presets with on/off switching added');


// Android SAF selection works without MANAGE_EXTERNAL_STORAGE. On Android
// 11+ the original request_manage_storage_permission command opens Settings
// then immediately resolves "denied"; gating the picker on that return
// prevented both the main folder row and Add another from ever opening.
// Let the user select first, then request scan permission at Confirm and keep
// the dialog mounted while the user grants it in system Settings.
patch('src/app/library/page.tsx',
  "      if (appService.isAndroidApp && !(await requestStoragePermission())) return undefined;\n      const response = await selectDirectory();\n      picked = response.path || undefined;",
  [
    "      // Android SAF can choose a folder without All Files Access.",
    "      // Request broad scan permission only when confirming the import.",
    "      let response;",
    "      try {",
    "        response = await selectDirectory();",
    "      } catch (error) {",
    "        console.error('Native directory picker failed:', error);",
    "        void eventDispatcher.dispatch('toast', {",
    "          type: 'error', timeout: 6500,",
    "          message: 'Could not open the Android folder picker. Please try again.',",
    "        });",
    "        return undefined;",
    "      }",
    "      if (response.error) {",
    "        console.error('Native directory picker error:', response.error);",
    "        void eventDispatcher.dispatch('toast', {",
    "          type: 'error', timeout: 6500, message: response.error,",
    "        });",
    "      }",
    "      picked = response.path || undefined;",
  ].join('\n'));

// Prevent the import dialog from vanishing during Android's settings
// round-trip. Permission rejection must be visible, not a silent no-op.
patch('src/app/library/page.tsx',
  "          onConfirm={(result) => {\n            setImportFromFolderState(null);",
  [
    "          onConfirm={async (result) => {",
    "            if (appService?.isAndroidApp) {",
    "              try {",
    "                if (!(await requestStoragePermission())) {",
    "                  void eventDispatcher.dispatch('toast', {",
    "                    type: 'error', timeout: 9000,",
    "                    message: 'Enable All files access for Readest Personal in Android Settings, return here and tap OK again.',",
    "                  });",
    "                  return;",
    "                }",
    "              } catch (error) {",
    "                console.error('Android storage permission failed:', error);",
    "                void eventDispatcher.dispatch('toast', {",
    "                  type: 'error', timeout: 7000,",
    "                  message: 'Could not check storage access. Please check Readest Personal permissions in Android Settings.',",
    "                });",
    "                return;",
    "              }",
    "            }",
    "            setImportFromFolderState(null);",
  ].join('\n'));

patch('src/app/library/page.tsx',
  "      showFilePicker().catch((err) => console.error('Failed to open file picker:', err));",
  [
    "      showFilePicker().catch((err) => {",
    "        console.error('Failed to open file picker:', err);",
    "        void eventDispatcher.dispatch('toast', {",
    "          type: 'error', timeout: 7000,",
    "          message: 'Could not open the file picker. Please retry or check the app installation.',",
    "        });",
    "      });",
  ].join('\n'));
console.log('Readest Personal: repaired Android folder picker permission flow and visible file picker errors');


// Disable the LIBRARY-ONLY pull-to-refresh/login gesture in Readest Personal.
// In upstream v0.12.12 both drag thresholds redirect signed-out users to
// /auth; removing this hook here prevents an unexpected login sheet while
// scrolling the bookshelf. Reader swipe-down bookmark lives in separate
// reader gesture handlers and is untouched. Menu sync and OPDS auto-sync stay.
patch('src/app/library/page.tsx',
  "import { usePullToRefresh } from '@/hooks/usePullToRefresh';\n",
  "");
patch('src/app/library/page.tsx',
  "import { navigateToLibrary, navigateToLogin, navigateToReader } from '@/utils/nav';",
  "import { navigateToLibrary, navigateToReader } from '@/utils/nav';");
patch('src/app/library/page.tsx',
  "  const { checkOPDSSubscriptions } = useOPDSSubscriptions();",
  "  useOPDSSubscriptions();");
patch('src/app/library/page.tsx',
  [
    "  usePullToRefresh(",
    "    scrollRef,",
    "    async () => {",
    "      if (!user) {",
    "        navigateToLogin(router);",
    "        return;",
    "      }",
    "      await pullLibrary(false, true);",
    "      checkOPDSSubscriptions(true);",
    "    },",
    "    async () => {",
    "      if (!user) {",
    "        navigateToLogin(router);",
    "        return;",
    "      }",
    "      await pullLibrary(true, true);",
    "      checkOPDSSubscriptions(true);",
    "    },",
    "  );",
  ].join('\n'),
  "  // Personal Android bookshelf: ordinary scrolling, no pull-down action.\n" +
  "  // The reader-only swipe-down bookmark gesture is intentionally preserved.");
console.log('Readest Personal: removed bookshelf drag-to-login, preserved reader bookmarking and manual/OPDS sync');


// Localize controls injected into original Readest components (not just
// standalone Personal UI). Keep persisted category keys, favorite tag IDs,
// status IDs and user-entered names unchanged.
function localizeInjected(file, replacements) {
  const target = path.join(app, file);
  let source = fs.readFileSync(target, 'utf8');
  for (const [from, to] of replacements) {
    if (source.split(from).length !== 2)
      throw new Error('Personal localization anchor mismatch: ' + file + ' ~ ' + from.slice(0, 70));
    source = source.replace(from, to);
  }
  const dependency = "import { personalText } from '@/utils/personalI18n';\n";
  if (!source.includes(dependency)) {
    source = source.startsWith("'use client';\n")
      ? source.replace("'use client';\n", "'use client';\n" + dependency)
      : dependency + source;
  }
  fs.writeFileSync(target, source);
}
localizeInjected('src/app/reader/components/HeaderBar.tsx', [
  ["title='PDF / text mode'", "title={personalText('PDF / text mode')}"],
  ["aria-label='Toggle PDF text reading mode'", "aria-label={personalText('Toggle PDF text reading mode')}"],
]);
localizeInjected('src/app/library/components/BookItem.tsx', [
  ["aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}",
   "aria-label={personalText(isFavorite ? 'Remove favorite' : 'Add favorite')}"],
  ["title={isFavorite ? 'Remove favorite' : 'Add favorite'}",
   "title={personalText(isFavorite ? 'Remove favorite' : 'Add favorite')}"],
]);
localizeInjected('src/app/library/components/SetStatusAlert.tsx', [
  ["aria-label='Custom reading status'", "aria-label={personalText('Custom reading status')}"],
  ["placeholder='Custom status…'", "placeholder={personalText('Custom status…')}"],
  [">+ Save status</button>", ">{personalText('+ Save status')}</button>"],
]);
localizeInjected('src/app/library/components/BookshelfStream.tsx', [
  ["aria-label='Filter quick reading shelf'", "aria-label={personalText('Filter quick reading shelf')}"],
  ...['Recently read', 'Reading now', 'Unread', 'Finished', 'On hold', '★ Favorites']
    .map((label) => [">" + label + "</option>", ">{personalText('" + label + "')}</option>"]),
]);
localizeInjected('src/app/library/components/ImportFromFolderDialog.tsx', [
  ["+ Add another watched folder ({batchDirectories.length})",
   "{personalText('+ Add another watched folder')} ({batchDirectories.length})"],
  ["aria-label={'Remove folder '+path}",
   "aria-label={personalText('Remove folder') + ' ' + path}"],
]);
localizeInjected('src/app/library/page.tsx', [
  ...[
    'Could not open the Android folder picker. Please try again.',
    'Enable All files access for Readest Personal in Android Settings, return here and tap OK again.',
    'Could not check storage access. Please check Readest Personal permissions in Android Settings.',
    'Could not open the file picker. Please retry or check the app installation.',
  ].map((label) => ["message: '" + label + "'", "message: personalText('" + label + "')"]),
]);

// Copy the dictionary as a pure source file. It reads Readest's actual
// i18next language (UI setting -> system locale), never a separate locale flag.
fs.copyFileSync(path.join(local, 'personalI18n.ts'), path.join(app, 'src/utils/personalI18n.ts'));
fs.copyFileSync(path.join(local, 'personalI18n.test.ts'), path.join(app, 'src/__tests__/personalI18n.test.ts'));
console.log('Readest Personal: translated embedded UI via active Readest language');


// Always expose the Personal quick-reading/status filter on the library shelf.
// The upstream shelf builder removes sections with zero matching books, which
// used to hide this control before the user had opened their first book.
// A disabled upstream recent-shelf preference must not remove this navigation
// entry either; only the Personal APK opts into always showing it.
patch('src/app/library/components/Bookshelf.tsx',
  "import { resolveBookshelfLayout } from '@/services/bookshelves/definitions';",
  "import { resolveBookshelfLayout, RECENT_BOOKSHELF_ID } from '@/services/bookshelves/definitions';");
patch('src/app/library/components/Bookshelf.tsx',
  "      storedDefinitions.map((s) => ({\n        ...s,\n        sort: resolveBookshelfSort(s, globalSort),",
  "      storedDefinitions.map((s) => ({\n        ...s,\n        // Always keep the Personal status filter accessible on the main bookshelf.\n        enabled: s.id === RECENT_BOOKSHELF_ID ? true : s.enabled,\n        sort: resolveBookshelfSort(s, globalSort),");
patch('src/app/library/components/Bookshelf.tsx',
  "      .filter((section) => section.items.length > 0);",
  "      .filter((section) => section.items.length > 0 || section.definition.id === RECENT_BOOKSHELF_ID);");

// A distinct "read" filter includes partly read books as well as completed
// books; the built-in "reading" filter remains separately available.
patch('src/app/library/components/BookshelfStream.tsx',
  "      if(personalShelfFilter==='unread')return !b.progress?.[0] && (!b.readingStatus || b.readingStatus==='unread');",
  "      if(personalShelfFilter==='read')return b.readingStatus==='finished' || b.readingStatus==='reading' || !!b.progress?.[0];\n" +
  "      if(personalShelfFilter==='unread')return !b.progress?.[0] && (!b.readingStatus || b.readingStatus==='unread');");
patch('src/app/library/components/BookshelfStream.tsx',
  "                       <option value='reading'>{personalText('Reading now')}</option>",
  "                       <option value='read'>{personalText('Read books')}</option>\n" +
  "                       <option value='reading'>{personalText('Reading now')}</option>");

// Never clear custom status names from the dropdown just because no recent
// books match. The catalog comes from all visible library books; it reacts to
// tag changes after adding a custom status through the status dialog.
console.log('Readest Personal: recent/status dropdown stays visible with zero recent books');
