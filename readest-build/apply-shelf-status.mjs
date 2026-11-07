#!/usr/bin/env node
// Run AFTER apply-next.mjs: replace split status UIs with one catalog and one
// update function. No changes to book files, app identities or database schemas.
import fs from 'node:fs';
import path from 'node:path';
const app = path.resolve(process.argv[2] ?? 'upstream', 'apps/readest-app');
const local = path.dirname(new URL(import.meta.url).pathname);
function edit(relative, operation) {
  const file = path.join(app, relative);
  const original = fs.readFileSync(file, 'utf8');
  const result = operation(original);
  if (!result || result === original) throw Error('Status UI patch no-op: ' + relative);
  fs.writeFileSync(file, result);
}
function replaceOnce(source, from, to, hint) {
  if (source.split(from).length !== 2) throw Error('Status UI patch anchor: ' + hint + ': ' + from.slice(0, 110));
  return source.replace(from, to);
}
function replaceRange(source, startMarker, endMarker, replacement, hint) {
  const first = source.indexOf(startMarker);
  const last = source.indexOf(endMarker, first + startMarker.length);
  if (first < 0 || last < 0 || source.indexOf(startMarker, first + 1) >= 0)
    throw Error('Status UI patch range: ' + hint);
  return source.slice(0, first) + replacement + source.slice(last);
}
for (const [name, dst] of [
  ['personalShelfStatuses.ts', 'src/utils/personalShelfStatuses.ts'],
  ['personalShelfStatuses.test.ts', 'src/__tests__/personalShelfStatuses.test.ts'],
  ['PersonalShelfDropdown.tsx', 'src/app/library/components/PersonalShelfDropdown.tsx'],
  ['PersonalSetStatusAlert.tsx', 'src/app/library/components/SetStatusAlert.tsx'],
]) {
  // The original modal is intentionally REPLACED: no duplicated Mark as XX buttons.
  fs.copyFileSync(path.join(local, name), path.join(app, dst));
}
edit('src/app/library/components/BookshelfStream.tsx', original => {
  let s = original;
  s = replaceOnce(s,
    "import { personalText } from '@/utils/personalI18n';\n", '', 'remove unused legacy dropdown i18n import');
  s = replaceOnce(s,
    "import { useLibraryPagination } from '../hooks/useLibraryPagination';",
    "import { useLibraryPagination } from '../hooks/useLibraryPagination';\nimport PersonalShelfDropdown from './PersonalShelfDropdown';\nimport {matchesPersonalStatus} from '@/utils/personalShelfStatuses';",
    'stream imports');
  s = replaceOnce(s,
    '  allBooks?: Book[];',
    '  allBooks?: Book[];\n  onDeletePersonalStatus?: (id: string) => Promise<void>;',
    'stream props');
  s = replaceOnce(s,
    '  allBooks,\n  autoColumns,',
    '  allBooks,\n  onDeletePersonalStatus,\n  autoColumns,',
    'stream arguments');
  const filterBegin = '  const customStatuses = useMemo(() => Array.from(new Set((allBooks??[]).flatMap(b =>';
  const rootAnchor = '  const root = useRef<HTMLDivElement>(null);';
  // The original stream filter's memo ends at its root ref.
  s = replaceRange(s, filterBegin, rootAnchor,
    "  const adjustedSections = useMemo(() => sections.map(section => {\n" +
    "    if (section.definition.id !== RECENT_BOOKSHELF_ID || personalShelfFilter === 'recent') return section;\n" +
    "    const matches = (allBooks ?? []).filter(book => matchesPersonalStatus(book, personalShelfFilter))\n" +
    "      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));\n" +
    "    return {...section, items: matches};\n" +
    "  }), [sections, allBooks, personalShelfFilter]);\n",
    'filter derivation');
  // Keep the single compact dropdown; remove the native select and separate heading.
  const heading = s.indexOf("                     {name}");
  const endHeading = s.indexOf("                     </select>}", heading);
  if (heading < 0 || endHeading < 0) throw Error('Status UI patch: patched dropdown heading not found');
  s = s.slice(0, heading) +
    "                    {definition.id === RECENT_BOOKSHELF_ID ? (\n" +
    "                      <PersonalShelfDropdown\n" +
    "                        value={personalShelfFilter}\n" +
    "                        onChange={id => {setPersonalShelfFilter(id); localStorage.setItem('readest-personal-shelf-filter', id);}}\n" +
    "                        books={allBooks ?? []}\n" +
    "                        onDeleteStatus={onDeletePersonalStatus ?? (async () => undefined)}\n" +
    "                      />\n" +
    "                    ) : name}\n" +
    s.slice(endHeading + "                     </select>}".length);
  const message = "{row.section.hideHeading ? _('No books') : _('No books in {{name}}', { name })}";
  s = replaceOnce(s, message,
    "{definition.id === RECENT_BOOKSHELF_ID ? '해당 상태의 책이 없습니다' : row.section.hideHeading ? _('No books') : _('No books in {{name}}', { name })}",
    'empty section deduplication');
  return s;
});
edit('src/app/library/components/Bookshelf.tsx', original => {
  let s = original;
  s = replaceOnce(s,
    "import SetStatusAlert from './SetStatusAlert';",
    "import SetStatusAlert from './SetStatusAlert';\nimport {\n  FAVORITE_TAG, STATUS_TAG_PREFIX, WRITING_TAG,\n  persistStatusCatalog, removeCustomStatus, readStatusCatalog,\n  mergeCatalogWithBookTags, STATUS_CATALOG_KEY,\n} from '@/utils/personalShelfStatuses';",
    'bookshelf imports');
  const begin='  const updateBooksStatus = async (status: ReadingStatus | undefined) => {';
  const end='  const handleUpdateReadingStatus = useCallback(';
  s = replaceRange(s, begin, end,
    "  // Both the shelf dropdown and batch status editor use the same persisted tags.\n" +
    "  const applyPersonalStatus = async (id: string | null) => {\n" +
    "    const selected = getSelectedBooks();\n" +
    "    const selectedBooks = selected.map(hash => filteredBooks.find(book => book.hash === hash))\n" +
    "      .filter((book): book is Book => !!book);\n" +
    "    const allFavorites = selectedBooks.length > 0 && selectedBooks.every(book => (book.tags ?? []).includes(FAVORITE_TAG));\n" +
    "    const changed = selectedBooks.map(book => {\n" +
    "      const previous = book.tags ?? [];\n" +
    "      if (id === 'favorites') {\n" +
    "        const tags = allFavorites ? previous.filter(tag => tag !== FAVORITE_TAG)\n" +
    "          : Array.from(new Set([...previous, FAVORITE_TAG]));\n" +
    "        return {...book, tags, updatedAt: Date.now()};\n" +
    "      }\n" +
    "      if (id === 'recent' || id === 'read') return book; // computed categories; not manually assignable\n" +
    "      const tags = previous.filter(tag => !tag.startsWith(STATUS_TAG_PREFIX));\n" +
    "      const customTag = id === 'writing' ? WRITING_TAG : id?.startsWith('custom:') ? STATUS_TAG_PREFIX + id.slice(7) : null;\n" +
    "      if (customTag) tags.push(customTag);\n" +
    "      const native = id === 'reading' || id === 'unread' || id === 'finished' || id === 'abandoned'\n" +
    "        ? id as ReadingStatus : undefined;\n" +
    "      const updated = withReadingStatus(book, native);\n" +
    "      return {...updated, tags, updatedAt: Date.now()};\n" +
    "    });\n" +
    "    if (changed.length) await updateBooks(envConfig, changed);\n" +
    "    setSelectedBooks([]);\n" +
    "    setShowStatusAlert(false);\n" +
    "    setShowSelectModeActions(true);\n" +
    "  };\n" +
    "  const deletePersonalStatus = async (id: string) => {\n" +
    "    if (!id.startsWith('custom:')) return;\n" +
    "    const tag = STATUS_TAG_PREFIX + id.slice(7);\n" +
    "    const affected = visibleBooks.filter(book => (book.tags ?? []).includes(tag))\n" +
    "      .map(book => ({...book, tags: (book.tags ?? []).filter(value => value !== tag), updatedAt: Date.now()}));\n" +
    "    if (affected.length) await updateBooks(envConfig, affected);\n" +
    "    const stored = readStatusCatalog(localStorage.getItem(STATUS_CATALOG_KEY));\n" +
    "    persistStatusCatalog(removeCustomStatus(mergeCatalogWithBookTags(stored, visibleBooks.filter(book =>\n" +
    "      !affected.some(changed => changed.hash === book.hash))), id));\n" +
    "  };\n\n", 'status assignment');
  s = replaceOnce(s, '            allBooks={visibleBooks}\n',
    '            allBooks={visibleBooks}\n            onDeletePersonalStatus={deletePersonalStatus}\n',
    'pass deletion to shelf');
  s = replaceOnce(s,
    "        <SetStatusAlert\n          selectedCount={getSelectedBooks().length}",
    "        <SetStatusAlert\n          books={visibleBooks}\n          selectedCount={getSelectedBooks().length}",
    'batch modal books');
  s = replaceOnce(s,
    '          onUpdateStatus={updateBooksStatus}',
    '          onApplyStatus={applyPersonalStatus}\n          onDeleteCustomStatus={deletePersonalStatus}',
    'batch action');
  return s;
});
console.log('Readest Personal: one protected status catalog, compact sortable bookshelf selector and synchronized batch actions');
