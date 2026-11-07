#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const recipe=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(process.argv[2]??'upstream','apps/readest-app');
for(const patch of JSON.parse(fs.readFileSync(path.join(recipe,'gallery-folder-fixes.json'),'utf8'))){
 const file=path.join(app,patch.path),source=fs.readFileSync(file,'utf8');
 if(source.includes(patch.after))continue;
 if(source.split(patch.before).length!==2)throw new Error('Gallery/folder patch anchor mismatch: '+patch.path);
 fs.writeFileSync(file,source.replace(patch.before,patch.after));
}
fs.copyFileSync(path.join(recipe,"gallery-PersonalSortableBook.tsx"),path.join(app,"src/app/library/components/PersonalSortableBook.tsx"));
fs.copyFileSync(path.join(recipe,"gallery-WatchedFoldersPane.tsx"),path.join(app,"src/app/library/components/WatchedFoldersPane.tsx"));
fs.copyFileSync(path.join(recipe,"gallery-personalBookOrder.ts"),path.join(app,"src/utils/personalBookOrder.ts"));
fs.copyFileSync(path.join(recipe,"gallery-personalWatchedFolders.ts"),path.join(app,"src/utils/personalWatchedFolders.ts"));
fs.copyFileSync(path.join(recipe,"gallery-personalBookOrder.test.tsx"),path.join(app,"src/__tests__/personalBookOrder.test.tsx"));
fs.copyFileSync(path.join(recipe,"gallery-personalWatchedFolders.test.tsx"),path.join(app,"src/__tests__/personalWatchedFolders.test.tsx"));
fs.copyFileSync(path.join(recipe,"gallery-import-from-folder-watched.test.tsx"),path.join(app,"src/__tests__/app/library/import-from-folder-watched.test.tsx"));
console.log('Gallery ghost/stack drag, manual-only order, group/move labels and watched-folder editing/removal applied');
