#!/usr/bin/env node
// Readest Personal selectable archive; expects upstream readest v0.12.16.
// Patches only known exact upstream anchors; fails CI loudly on upstream drift.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]??'.');
const app=path.join(root,'apps/readest-app');
const local=path.dirname(new URL(import.meta.url).pathname);
function patch(relative,before,after) {
  const full=path.join(app,relative);
  const source=fs.readFileSync(full,'utf8');
  const count=source.split(before).length-1;
  if(count!==1)throw new Error('Backup patch expected one anchor in '+relative+', found '+count+': '+before.slice(0,90));
  fs.writeFileSync(full,source.replace(before,after));
}
function copy(src,dst) {
  const target=path.join(app,dst);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.join(local,src),target);
}
copy('personalBackupSelection.ts','src/utils/personalBackupSelection.ts');
copy('PersonalBackupPanel.tsx','src/components/settings/PersonalBackupPanel.tsx');
copy('personalBackup.test.ts','src/__tests__/personalBackup.test.ts');
const service='src/services/backupService.ts';
patch(service,
  "import { configureZip } from '@/utils/zip';",
  "import { configureZip } from '@/utils/zip';\n"+
  "import { filterPersonalBookConfig, filterPersonalSettings, makePersonalManifest, PERSONAL_BACKUP_MANIFEST, PERSONAL_BACKUP_STORAGE, exportPersonalLocalStorage, importPersonalLocalStorage, readPersonalManifest, mergePersonalBookConfig, type PersonalBackupSelection } from '@/utils/personalBackupSelection';");
patch(service,
  '  includeCredentials?: boolean;\n}',
  '  includeCredentials?: boolean;\n  /** Optional v1 selective snapshot. Undefined keeps the official backup contract. */\n  selection?: PersonalBackupSelection;\n}');
patch(service,
  '    texts.push({ name: SETTINGS_BACKUP_FILENAME, content: JSON.stringify(sanitized, null, 2) });',
  '    texts.push({ name: SETTINGS_BACKUP_FILENAME, content: JSON.stringify(options.selection ? filterPersonalSettings(sanitized, options.selection) : sanitized, null, 2) });');
patch(service,
  '  try {\n    const stats = await StatisticsDb.open(appService);',
  '  if (!options.selection || options.selection.statistics) try {\n    const stats = await StatisticsDb.open(appService);');
patch(service,
  "  const bookFiles = files\n",
  "  let bookFiles = files\n");
patch(service,
  "    .filter(({ entryName }) => !isAbsOfflineEntry(entryName))",
  "    .filter(({ entryName }) => !!options.selection?.serverBooks || !isAbsOfflineEntry(entryName))");
patch(service,
  "    .filter(({ entryName }) => !entryName.endsWith('.part'));\n  return { texts, files: bookFiles };",
  `    .filter(({ entryName }) => !entryName.endsWith('.part'));
  if (options.selection) {
    // Keep per-book JSON in the archive even for a settings-only backup.
    // Text entries are understood by both the native streaming ZIP writer and zip.js.
    const configFiles = bookFiles.filter(({entryName}) => entryName.endsWith('/config.json'));
    for (const {file,entryName} of configFiles) {
      try {
        const raw = await appService.readFile(file.path, 'Books', 'text') as string;
        const config = filterPersonalBookConfig(JSON.parse(raw) as Partial<BookConfig>, options.selection);
        texts.push({ name: entryName, content: JSON.stringify(config) });
      } catch (error) { throw new Error('Cannot include book configuration '+entryName+': '+String(error)); }
    }
    bookFiles = bookFiles.filter(({entryName}) => !entryName.endsWith('/config.json'));
    if (!options.selection.bookFiles) bookFiles = [];
    texts.push({ name: PERSONAL_BACKUP_MANIFEST, content: makePersonalManifest(options.selection) });
    texts.push({ name: PERSONAL_BACKUP_STORAGE,
      content: JSON.stringify(exportPersonalLocalStorage(options.selection)) });
  }
  return { texts, files: bookFiles };`);
patch(service,
  '  const backupBooks: Book[] = JSON.parse(new TextDecoder().decode(libraryData));',
  `  const backupBooks: Book[] = JSON.parse(new TextDecoder().decode(libraryData));
  // v1 optional manifest: legacy Readest ZIPs remain fully compatible.
  const manifestEntry = fileEntries.find(e => e.filename === PERSONAL_BACKUP_MANIFEST);
  let personalSelection: PersonalBackupSelection | null = null;
  if (manifestEntry) {
    if ((manifestEntry.uncompressedSize ?? 0) > 65536) {
      await reader.close();
      throw new Error('Readest Personal manifest is too large');
    }
    const manifest = await manifestEntry.getData!(new Uint8ArrayWriter());
    personalSelection = readPersonalManifest(JSON.parse(new TextDecoder().decode(manifest)));
  }`);
const bookEntriesAnchor = '    const bookFileEntries = fileEntries.filter((e) => e.filename.startsWith(`'+ '${bookDir}' +'/`));';
patch(service,
  bookEntriesAnchor + '\n\n    if (existingBook) {',
  [bookEntriesAnchor,
   '    if (personalSelection && !personalSelection.bookFiles) {',
   '      // Metadata-only backup must not create phantom books or overwrite library rows.',
   '      if (!existingBook) continue;',
   "      configMerges.push(...bookFileEntries.filter(e => e.filename.endsWith('/config.json')));",
   '      booksUpdated++;',
   '      continue;',
   '    }',
   '',
   '    if (existingBook) {'].join('\n'));
patch(service,
  '    const mergedConfig = mergeBookConfigs(currentConfig, backupConfig);',
  '    const mergedConfig = personalSelection ? mergePersonalBookConfig(currentConfig, backupConfig, personalSelection) : mergeBookConfigs(currentConfig, backupConfig);');
patch(service,
  "  await reader.close();\n\n  return { booksAdded, booksUpdated, settingsRestored };",
  `  if (personalSelection) {
    const stored = fileEntries.find(e => e.filename === PERSONAL_BACKUP_STORAGE);
    if (stored) {
      if ((stored.uncompressedSize ?? 0) > 5_242_880) {
        await reader.close();
        throw new Error('Readest Personal storage snapshot is too large');
      }
      const data = await stored.getData!(new Uint8ArrayWriter());
      importPersonalLocalStorage(JSON.parse(new TextDecoder().decode(data)), personalSelection);
    }
  }
  await reader.close();

  return { booksAdded, booksUpdated, settingsRestored };`);
// The command palette requires a total icon map for SettingsPanelType.
patch('src/services/commandRegistry.ts',
  '  Custom: IoAccessibilityOutline,\n};',
  '  Custom: IoAccessibilityOutline,\n  Backup: IoAccessibilityOutline,\n};');
const dialog='src/components/settings/SettingsDialog.tsx';
patch(dialog,
  "import { IoAccessibilityOutline } from 'react-icons/io5';",
  "import { IoAccessibilityOutline } from 'react-icons/io5';\nimport { RiArchiveLine } from 'react-icons/ri';\nimport PersonalBackupPanel from './PersonalBackupPanel';");
patch(dialog,
  "  | 'Custom';",
  "  | 'Custom'\n  | 'Backup';");
patch(dialog,
  "    {\n      tab: 'Custom',\n      icon: IoAccessibilityOutline,\n      label: _('Custom'),\n    },",
  "    {\n      tab: 'Custom',\n      icon: IoAccessibilityOutline,\n      label: _('Custom'),\n    },\n    {tab: 'Backup',icon: RiArchiveLine,label: '백업 · 복원'},");
patch(dialog,
  "    Custom: null,",
  "    Custom: null,\n    Backup: null,");
patch(dialog,
  "        custom: 'Custom',",
  "        custom: 'Custom',\n        backup: 'Backup',");
patch(dialog,
  "        {activePanel === 'Custom' && (",
  "        {activePanel === 'Backup' && <PersonalBackupPanel />}\n        {activePanel === 'Custom' && (");
console.log('Readest Personal: selective ZIP backup, validated restore and new settings tab wired');
