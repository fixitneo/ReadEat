import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(process.argv[2]??'.');const spec=JSON.parse(fs.readFileSync(new URL('./readit17.json',import.meta.url),'utf8'));const pending=new Map();
for(const {file,hunks} of spec.patches){const target=path.join(root,file);let value=fs.readFileSync(target,'utf8');for(const {before,after} of hunks){if(!before||value.split(before).length!==2)throw Error('rEadiT17 anchor mismatch '+file);value=value.replace(before,after);}pending.set(target,value);}
for(const [file,value] of Object.entries(spec.files))pending.set(path.join(root,file),value);
for(const [target,value] of pending){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);}await import('./apply-readit17-assets.mjs');console.log('Applied rEadiT17 design',spec.patches.length,Object.keys(spec.files).length);
