import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]??'.');
const app=path.join(root,'apps/readest-app');
const spec=JSON.parse(fs.readFileSync(new URL('./readit.json',import.meta.url),'utf8'));
const pending=new Map();
for(const {file,hunks} of spec.patches){
 const target=path.join(app,file);let value=fs.readFileSync(target,'utf8');
 for(const {before,after} of hunks){
  if(!before||value.split(before).length!==2)throw Error('rEadiT anchor mismatch: '+file);
  value=value.replace(before,after);
 }
 pending.set(target,value);
}
for(const [file,value] of Object.entries(spec.files))pending.set(path.join(app,file),value);
for(const [target,value] of pending){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);}
console.log('Applied rEadiT final stage:',spec.patches.length,'patch groups,',Object.keys(spec.files).length,'new files');
