#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??'upstream');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
const library=read('apps/readest-app/src/app/library/components/LibraryHeader.tsx');
assert.match(library,/MdHelpOutline/);
assert.match(library,/PersonalShelfHelp open=/);
const help=read('apps/readest-app/src/app/library/components/PersonalShelfHelp.tsx')+read('apps/readest-app/src/app/library/components/PersonalGettingStarted.tsx')+read('apps/readest-app/src/utils/readitHelp.ts');
assert.match(help,/ReadEat/);
assert.match(help,/PDF/);
assert.match(help,/설정/);
const theme=read('apps/readest-app/src/components/settings/ThemePanel.tsx');
assert.match(theme,/PersonalBackgroundCrop textureId/);
const bg=read('apps/readest-app/src/hooks/useBackgroundTexture.ts');
assert.match(bg,/setBackgroundCropVariables\(textureId/);
assert.match(bg,/addEventListener\('resize'/);
const util=read('apps/readest-app/src/utils/personalBackgroundCrop.ts');
assert.match(util,/backgroundCropKey/);
const ts=read('apps/readest-app/src/types/settings.ts');
assert.match(ts,/backgroundCrops\?:/);
const helpIndex=library.indexOf("aria-label='도움말'");
const viewIndex=library.indexOf("label='정렬 및 필터'");
const settingsIndex=library.indexOf("label={_('Settings Menu')}");
assert.ok(helpIndex >= 0 && helpIndex < viewIndex && viewIndex < settingsIndex,
  'Expected Help, View, Settings control order');
const pdf=read('packages/foliate-js/pdf.js');
assert.doesNotMatch(pdf,/const touchPan = e.pointerType === 'touch'/);
const viewer=read('apps/readest-app/src/app/reader/components/FoliateViewer.tsx');
assert.doesNotMatch(viewer,/const enforceSpread\s*=/);
assert.doesNotMatch(viewer,/width<760\?'none'/);
assert.doesNotMatch(viewer,/if\(\(containerRef.current\?\.clientWidth \|\| window.innerWidth\)<760\)/);
const styles=read('apps/readest-app/src/utils/style.ts');
assert.doesNotMatch(styles,/format === 'PDF' && !isThemedPDF \? 'background-color: #ffffff;'/);
console.log('Readest Personal help order, photo crop and conservative PDF rollback verification passed.');
