#!/usr/bin/env node
// Run after the existing Personal patch chain and apply-personal-reading-vault.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const app=path.join(path.resolve(process.argv[2]??'upstream'),'apps/readest-app');
const patches=JSON.parse(fs.readFileSync(path.join(here,'reading-interactions.json'),'utf8'));
// Validate every anchor in memory before changing any source.
const pending=new Map();
for(const {file,hunks} of patches){
  const dest=path.join(app,file);let source=fs.readFileSync(dest,'utf8');
  for(const hunk of hunks){
    if(source.includes(hunk.after))continue;
    if(source.split(hunk.before).length!==2)throw Error('Interaction patch drift: '+file);
    source=source.replace(hunk.before,hunk.after);
  }
  pending.set(dest,source);
}
for(const [dest,source] of pending)fs.writeFileSync(dest,source);
const copies={
  'personalInteraction.ts':'src/utils/personalInteraction.ts',
  'personalManualTurn.ts':'src/utils/personalManualTurn.ts',
  'PersonalInteractionSettings.tsx':'src/components/settings/PersonalInteractionSettings.tsx',
  'interaction-PageTurnSound.tsx':'src/components/settings/PersonalPageTurnSound.tsx',
};
for(const name of ['personalInteraction.test.ts','personalRestoreIsolation.test.ts',
  'personalDictionaryButton.test.tsx','personalManualTurn.test.ts','personalZipRestore.test.ts',
  'personalAudioProfile.test.ts','personalPageMotion.browser.test.ts'])copies[name]='src/__tests__/'+name;
for(const [source,target] of Object.entries(copies))fs.copyFileSync(path.join(here,source),path.join(app,target));
fs.copyFileSync(path.join(here,'interaction-PageTurnSound.tsx'),path.join(app,'src/app/reader/components/PersonalPageTurnSound.tsx'));
console.log('Installed: WebGL presets/speed, dual dictionary, committed-turn audio, vault grouping and selective restore fixes');
