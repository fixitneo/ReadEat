#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const recipe=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(process.argv[2]??'upstream','apps/readest-app');
const patches=JSON.parse(fs.readFileSync(path.join(recipe,'reader-library-fixes.json'),'utf8'));
for(const patch of patches){
 const file=path.join(app,patch.path),source=fs.readFileSync(file,'utf8');
 if(source.includes(patch.after))continue;
 if(source.split(patch.before).length!==2)throw new Error('Reader/library patch anchor mismatch: '+patch.path);
 fs.writeFileSync(file,source.replace(patch.before,patch.after));
}
fs.copyFileSync(path.join(recipe,"personalBookOrder.ts"),path.join(app,"src/utils/personalBookOrder.ts"));
fs.copyFileSync(path.join(recipe,"personalEPUBRepair.ts"),path.join(app,"src/utils/personalEPUBRepair.ts"));
fs.copyFileSync(path.join(recipe,"PersonalSortableBook.tsx"),path.join(app,"src/app/library/components/PersonalSortableBook.tsx"));
fs.copyFileSync(path.join(recipe,"personalBookOrder.test.tsx"),path.join(app,"src/__tests__/personalBookOrder.test.tsx"));
fs.copyFileSync(path.join(recipe,"personalEPUBRepair.test.ts"),path.join(app,"src/__tests__/personalEPUBRepair.test.ts"));
console.log('Personal EPUB package namespace repair and persisted touch book ordering applied');
