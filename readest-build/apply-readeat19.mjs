import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const manifest = new URL('./readeat19.json', import.meta.url);
const patches = JSON.parse(readFileSync(manifest, 'utf8'));
const staged = patches.map(({ file, hunks }) => {
  const target = resolve(root, file);
  let source = readFileSync(target, 'utf8');
  for (const { before, after } of hunks) {
    if (!before || source.split(before).length !== 2) {
      throw new Error(`ReadEat 1800019 patch anchor mismatch in ${file}`);
    }
    source = source.replace(before, () => after);
  }
  return { target, source };
});
for (const { target, source } of staged) writeFileSync(target, source);
console.log(`ReadEat 1800019 applied to ${staged.length} files`);
