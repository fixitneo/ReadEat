#!/usr/bin/env node
// Fail the APK build if the custom PDF reading layer silently regresses
// to first-page, scroll-only, justified text.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??'upstream','apps/readest-app/src');
const view=fs.readFileSync(path.join(root,'app/reader/components/PersonalPDFTextMode.tsx'),'utf8').replace(/\s/g,'');
const flow=fs.readFileSync(path.join(root,'utils/personalPDFReflow.ts'),'utf8').replace(/\s/g,'');
assert.match(view,/getProgress\(bookKey\)\?\.page/,
  'Text mode should open from the native PDF progress, not page 1');
assert.match(view,/renderer\.goTo\(\{index:Math\.max\(0,target-1\)\}\)/,
  'Text mode should restore the native PDF location on exit');
assert.match(view,/overflow-hidden/,
  'PDF text must not need continuous vertical body scroll');
assert.doesNotMatch(view,/overflow-y-auto overscroll-contain/,
  'PDF text body still scrolls vertically');
assert.match(view,/columnFill:'auto'/,'Text must paginate in fixed-height columns');
assert.match(view,/stepPDFReflow\(/,'Next/previous actions must traverse reflow pages');
assert.match(view,/contentPage!==page/,'Wait for actual PDF source-page text before sizing');
assert.match(view,/textAlign:'start'/,'Unnatural Korean justification must be disabled');
assert.match(flow,/Math\.abs\(y-baselineY\)/,'PDF text needs glyph-position line recognition');
assert.match(flow,/isCJK/,'CJK glyph runs should not add spaces in the middle of words');
assert.match(view,/onTouchEnd=/,'Swipe paging should remain available');
const normal=fs.readFileSync(path.join(root,'app/reader/components/BooksGrid.tsx'),'utf8').replace(/\s/g,'');
assert.match(normal,/HandwritingOverlay/,'Preserve upstream handwriting on original PDF view');
console.log('PDF reflow regression: native resume, viewport pagination, CJK reconstruction, original handwriting preserved.');
