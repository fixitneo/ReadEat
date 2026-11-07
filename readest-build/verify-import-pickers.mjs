#!/usr/bin/env node
// Regression guard for the Android book-import picker flow after patching v0.12.12.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(process.argv[2] ?? 'upstream');
const app=path.join(root,'apps/readest-app/src/app/library');
const page=fs.readFileSync(path.join(app,'page.tsx'),'utf8');
const dialog=fs.readFileSync(path.join(app,'components/ImportFromFolderDialog.tsx'),'utf8');
const locate=(text,sub) => {
  const index=text.indexOf(sub);
  assert.ok(index>=0,'Missing expected import implementation: '+sub);
  return index;
};
const pickBegin=locate(page,'const pickImportDirectory = async');
const pickEnd=locate(page,'const validatePickedDirectory =');
const pick=page.slice(pickBegin,pickEnd);
assert.match(pick,/await selectDirectory\(\)/,'SAF picker must still launch');
assert.doesNotMatch(pick,/&&\s*!\(await requestStoragePermission\(\)\)/,
  'Permission must not silently abort the native SAF picker');
assert.match(pick,/Native directory picker failed/,'Picker errors must be visible');
assert.match(pick,/response\.error/,'Native SAF errors must be visible');
const confirm=page.slice(locate(page,'onConfirm={async (result) => {'));
assert.match(confirm,/await requestStoragePermission\(\)/,
  'Android permission must be checked before scanning');
assert.ok(confirm.indexOf('await requestStoragePermission()') <
  confirm.indexOf('setImportFromFolderState(null)'),
  'Import dialog must remain visible until permission is granted');
assert.match(confirm,/return;/,'Permission denial must abort instead of closing the dialog');
assert.match(page,/showFilePicker\(\)\.catch\(\(err\) => \{/,
  'File picker failures should be reported');
assert.match(page,/Could not open the file picker/);
assert.match(dialog,/onClick=\{handlePickDirectory\}/);
assert.match(dialog,/onClick=\{\(\) => void handlePickAdditional\(\)\}/);
assert.match(dialog,/directories: Array\.from\(new Set\(\[\.\.\.batchDirectories,\s*directory\]\)\)/);
assert.match(dialog,/onClick=\{handleConfirm\}/);
console.log('Android book picker regression checks passed: SAF selection, Add another, Confirm, error feedback.');


// Personal APK: shelf drag must never open login or trigger cloud pull.
// Keep all reader-only touch gestures and explicit/manual sync paths.
assert.doesNotMatch(page,/\busePullToRefresh\b/,
  'Bookshelf must not register pull-to-refresh touch listeners');
assert.doesNotMatch(page,/\bnavigateToLogin\b/,
  'Bookshelf must not import or invoke login navigation for a drag');
assert.match(page,/\buseOPDSSubscriptions\(\);/,
  'Keep OPDS automatic subscription refresh active');
assert.match(page,/onPullLibrary=\{pullLibrary\}/,
  'Keep explicit menu-driven cloud sync available');
const gesture=fs.readFileSync(
  path.join(root,'apps/readest-app/src/app/reader/utils/bookmarkPullGesture.ts'),'utf8');
const reader=fs.readFileSync(
  path.join(root,'apps/readest-app/src/app/reader/components/BookmarkPullDown.tsx'),'utf8');
assert.match(gesture,/canPullBookmark/,'Keep reader bookmark gesture eligibility logic');
assert.match(reader,/BOOKMARK_PULL_ACTIVATION_PX/,'Keep reader pull-down bookmark activation');
console.log('Bookshelf gesture checks passed: drag-to-login removed; reader bookmark and sync kept.');
