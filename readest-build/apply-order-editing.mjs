#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const recipe=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(process.argv[2]??'upstream','apps/readest-app');
for(const patch of JSON.parse(fs.readFileSync(path.join(recipe,'order-editing-fixes.json'),'utf8'))){
 const file=path.join(app,patch.path),source=fs.readFileSync(file,'utf8');
 if(source.includes(patch.after))continue;
 if(source.split(patch.before).length!==2)throw new Error('Order editing patch anchor mismatch: '+patch.path);
 fs.writeFileSync(file,source.replace(patch.before,patch.after));
}
fs.copyFileSync(path.join(recipe,"order-editing-PersonalSortableBook.tsx"),path.join(app,"src/app/library/components/PersonalSortableBook.tsx"));
fs.copyFileSync(path.join(recipe,"order-editing-personalBookOrder.test.tsx"),path.join(app,"src/__tests__/personalBookOrder.test.tsx"));
fs.copyFileSync(path.join(recipe,"order-editing-personalOrderEditing.test.tsx"),path.join(app,"src/__tests__/personalOrderEditing.test.tsx"));
console.log('Manual order handles now appear only during selection editing; Done exits editing');
