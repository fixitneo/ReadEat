#!/usr/bin/env node
// Readest Personal AI quick actions + compact bookshelf UX.
// Applied after apply-shelf-status.mjs and apply-backup.mjs.
import fs from 'node:fs';
import path from 'node:path';
const app=path.resolve(process.argv[2]??'upstream','apps/readest-app');
const local=path.dirname(new URL(import.meta.url).pathname);
function patch(filename,from,to) {
 const target=path.join(app,filename);const s=fs.readFileSync(target,'utf8');
 if(s.split(from).length!==2) throw Error('Personal AI/UX anchor missing: '+filename+' / '+from.slice(0,80));
 fs.writeFileSync(target,s.replace(from,to));
}
function transform(filename,fn) {
 const target=path.join(app,filename);const previous=fs.readFileSync(target,'utf8'),after=fn(previous);
 if(previous===after)throw Error('Personal AI/UX transform no-op '+filename);
 fs.writeFileSync(target,after);
}
for(const [file,dest] of [
 ['personalAIQuick.ts','src/utils/personalAIQuick.ts'],
 ['PersonalAskAIDialog.tsx','src/components/PersonalAskAIDialog.tsx'],
 ['PersonalAIPromptSettings.tsx','src/components/settings/PersonalAIPromptSettings.tsx'],
 ['personalAIQuick.test.ts','src/__tests__/personalAIQuick.test.ts']
])fs.copyFileSync(path.join(local,file),path.join(app,dest));

// The prior UX displayed horizontal movement when dnd-kit computed an X
// transform; PersonalShelfDropdown already applies Y-only transform.
const status=fs.readFileSync(path.join(app,'src/app/library/components/PersonalShelfDropdown.tsx'),'utf8');
if(status.includes('드래그하여 순서 변경')||status.includes('transform: CSS.Transform.toString'))
 throw Error('Dropdown still contains horizontal movement or instruction label');

// Match the view button's visual affordance to its actual filter/sort functions.
patch('src/app/library/components/LibraryHeader.tsx',
 "import { PiDotsThreeCircle } from 'react-icons/pi';",
 "import { MdTune } from 'react-icons/md';");
patch('src/app/library/components/LibraryHeader.tsx',
 "toggleButton={<PiDotsThreeCircle role='none' size={iconSize18} />}",
 "toggleButton={<MdTune role='none' size={iconSize18} />}");
patch('src/app/library/components/LibraryHeader.tsx',
 "label={_('View Menu')}",
 "label='정렬 및 필터'");

// The View menu should match the on-screen interaction: sort before group.
patch('src/app/library/components/ViewMenu.tsx',
 "label={_('Bookshelves')}",
 "label='책장 설정'");
transform('src/app/library/components/ViewMenu.tsx',s=>{
 const a=s.indexOf('      {/* Group By - Collapsible */}'), b=s.indexOf('      {/* Sort By - Collapsible */}'), c=s.indexOf('      {/* Then by - secondary sort',b);
 const d=s.indexOf('    </Menu>',c);
 if(a<0||b<0||c<0||d<0)throw Error('ViewMenu group/sort anchors changed');
 return s.slice(0,a)+s.slice(b,c)+s.slice(c,d)+s.slice(a,b)+s.slice(d);
});

// Change the actual Bookshelf settings dialog, plus its fieldset ordering.
patch('src/app/library/components/BookshelvesDialog.tsx',
 "title={_('Manage Bookshelves')}",
 "title='책장 설정'");
transform('src/app/library/components/BookshelvesDialog.tsx',s=>{
 const legendGroup="<legend className='-ms-1 px-1 text-sm'>{_('Grouping')}</legend>";
 const legendSort="<legend className='-ms-1 px-1 text-sm'>{_('Sorting')}</legend>";
 const groupLegend=s.indexOf(legendGroup), sortLegend=s.indexOf(legendSort);
 if(groupLegend<0||sortLegend<0||sortLegend<groupLegend)throw Error('Bookshelf editor group/sort anchors changed');
 const tag="<fieldset className='eink-bordered border-base-200 min-w-0 rounded-lg border ps-4'>";
 const first=s.lastIndexOf(tag,groupLegend), middle=s.lastIndexOf(tag,sortLegend), end=s.indexOf("            <BoxedList>",sortLegend+legendSort.length);
 if(first<0||middle<0||end<0||middle<=first)throw Error('Bookshelf editor fieldset anchors changed');
 return s.slice(0,first)+s.slice(middle,end)+s.slice(first,middle)+s.slice(end);
});
// tactile selection: one heavy impact only on entering selection mode;
// subsequent selections don't endlessly buzz.
patch('src/app/library/page.tsx',
 "    if (selectMode && appService?.hasHaptics) {\n      impactFeedback('medium');",
 "    if (selectMode && appService?.hasHaptics) {\n      void impactFeedback('heavy').catch(() => {});");
patch('src/app/library/components/BookshelfItem.tsx',
 "pressing && mode === 'grid' ? 'not-eink:scale-95' : 'scale-100',",
 "pressing && mode === 'grid' ? 'not-eink:scale-[0.965]' : 'scale-100',");
patch('src/app/library/components/BookshelfItem.tsx',
 "          transition: 'transform 0.2s',",
 "          transition: 'transform 0.16s cubic-bezier(0.2, 1.3, 0.3, 1)',");
// Native context menus on desktop and fallback should allow the same action
// without moving the selected books or reading source file.
patch('src/app/library/components/BookshelfItem.tsx',
 "    return getBookContextMenuItemIds(book, {",
 "    const ids = getBookContextMenuItemIds(book, {");
patch('src/app/library/components/BookshelfItem.tsx',
 "    }).map((id) => itemOptions[id]);",
 "    }).map((id) => itemOptions[id]);\n" +
 "    return [{text:'AI에게 물어보기', action:async()=>{eventDispatcher.dispatch('readest-personal-ai-ask',{books:[book]});}},...ids];");
patch('src/app/library/components/BookshelfItem.tsx',
 "    return [\n      {\n        text: itemSelected ? _('Deselect Group') : _('Select Group'),",
 "    return [\n      {text:'AI에게 물어보기', action:async()=>{eventDispatcher.dispatch('readest-personal-ai-ask',{books:group.books});}},\n      {\n        text: itemSelected ? _('Deselect Group') : _('Select Group'),");

// Mobile long-press opens selection actions, not native menu. Add the button there.
patch('src/app/library/components/SelectModeActions.tsx',
 "  MdLabelOutline,",
 "  MdLabelOutline,\n  MdAutoAwesome,");
patch('src/app/library/components/SelectModeActions.tsx',
 "  onStatus: () => void;",
 "  onStatus: () => void;\n  onAskAI?: () => void;");
patch('src/app/library/components/SelectModeActions.tsx',
 "  onStatus,\n  onDownload,",
 "  onStatus,\n  onAskAI,\n  onDownload,");
patch('src/app/library/components/SelectModeActions.tsx',
 "        <button\n          onClick={onDetails}",
 "        {onAskAI && <button type='button' onClick={onAskAI} disabled={!hasSelection}\n          className='flex flex-col items-center justify-center gap-1 disabled:opacity-40'>\n" +
 "          <MdAutoAwesome/><span>AI에게 물어보기</span>\n        </button>}\n        <button\n          onClick={onDetails}");

patch('src/app/library/components/Bookshelf.tsx',
 "import SetStatusAlert from './SetStatusAlert';",
 "import SetStatusAlert from './SetStatusAlert';\nimport PersonalAskAIDialog from '@/components/PersonalAskAIDialog';");
patch('src/app/library/components/Bookshelf.tsx',
 "  const [showStatusAlert, setShowStatusAlert] = useState(false);",
 "  const [showStatusAlert, setShowStatusAlert] = useState(false);\n  const [personalAskBooks,setPersonalAskBooks] = useState<Book[]|null>(null);");
patch('src/app/library/components/Bookshelf.tsx',
 "    eventDispatcher.on('delete-books', handleDeleteBooksIntent);",
 "    const openAI=(e:CustomEvent)=>{\n      const books=(e.detail as {books?:Book[]}|undefined)?.books;\n      if(books?.length)setPersonalAskBooks(books);\n    };\n    eventDispatcher.on('readest-personal-ai-ask',openAI);\n    eventDispatcher.on('delete-books', handleDeleteBooksIntent);");
patch('src/app/library/components/Bookshelf.tsx',
 "      eventDispatcher.off('delete-books', handleDeleteBooksIntent);",
 "      eventDispatcher.off('readest-personal-ai-ask',openAI);\n      eventDispatcher.off('delete-books', handleDeleteBooksIntent);");
patch('src/app/library/components/Bookshelf.tsx',
 "          onStatus={showStatusSelection}",
 "          onStatus={showStatusSelection}\n          onAskAI={() => {\n            const ids=getSelectedBooks();\n            const picked=visibleBooks.filter(book=>ids.includes(book.hash));\n            const grouped=sortedBookshelfItems.flatMap(item =>\n              !('format' in item) && ids.includes(item.id) ? item.books : []);\n            const unique=Array.from(new Map([...picked,...grouped].map(book=>[book.hash,book])).values());\n            if(unique.length)setPersonalAskBooks(unique);\n          }}");
patch('src/app/library/components/Bookshelf.tsx',
 "      <ShareBookDialog\n        isOpen=",
 "      {personalAskBooks && <PersonalAskAIDialog books={personalAskBooks} onClose={()=>setPersonalAskBooks(null)}/>}\n      <ShareBookDialog\n        isOpen=");

// AI panel already supports Ollama, AI Gateway and OpenAI-compatible
// providers. Add only the prompt editor, not a second API key store.
patch('src/components/settings/AIPanel.tsx',
 "import { BoxedList, SettingLabel, SettingsRow, SettingsSwitchRow } from './primitives';",
 "import { BoxedList, SettingLabel, SettingsRow, SettingsSwitchRow } from './primitives';\nimport PersonalAIPromptSettings from './PersonalAIPromptSettings';");
patch('src/components/settings/AIPanel.tsx',
 "      <BoxedList title={_('Connection')} className={disabledSection}>",
 "      <PersonalAIPromptSettings />\n      <BoxedList title={_('Connection')} className={disabledSection}>");

// Production AI tab and settings swipe are owned by apply-settings-enhancements.mjs.
// Render the AI action inside Readest's actual selection toolbar; the existing
// quote text is held in state before selection can disappear.
patch('src/app/reader/components/annotator/Annotator.tsx',
 "import { RiDeleteBinLine } from 'react-icons/ri';",
 "import { RiDeleteBinLine } from 'react-icons/ri';\nimport { MdAutoAwesome } from 'react-icons/md';\nimport PersonalAskAIDialog from '@/components/PersonalAskAIDialog';");
patch('src/app/reader/components/annotator/Annotator.tsx',
 "  const [selection, setSelection] = useState<TextSelection | null>(null);",
 "  const [selection, setSelection] = useState<TextSelection | null>(null);\n  const [personalAskQuote,setPersonalAskQuote] = useState<string|null>(null);");
patch('src/app/reader/components/annotator/Annotator.tsx',
 "  const toolButtons = toolbarToolTypes\n    .map(buildToolButton)\n    .filter((button): button is NonNullable<typeof button> => button !== null);",
 "  const toolButtons = [\n    ...toolbarToolTypes.map(buildToolButton)\n      .filter((button): button is NonNullable<typeof button> => button !== null),\n    ...(selection?.text?.trim() ? [{tooltipText:'AI에게 물어보기',Icon:MdAutoAwesome,\n      onClick:()=>setPersonalAskQuote(selection.text)}] : []),\n  ];");
patch('src/app/reader/components/annotator/Annotator.tsx',
 "      {showAnnotPopup &&\n        !noteEditorInSheet",
 "      {personalAskQuote && <PersonalAskAIDialog\n        books={bookData.book ? [bookData.book] : []}\n        quote={personalAskQuote} onClose={()=>setPersonalAskQuote(null)}/>}\n      {showAnnotPopup &&\n        !noteEditorInSheet");
console.log('Readest Personal: compact shelf UI, stronger haptics, metadata-only AI and excerpt AI with templates wired');
