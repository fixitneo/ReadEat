import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2] ?? '.');
const file = process.argv.includes('--native') ? './readeat20-native.patch' : './readeat20.patch';
const patch = fileURLToPath(new URL(file, import.meta.url));
const assets = process.argv.includes('--native') ? [] : JSON.parse(readFileSync(new URL('./readeat20-binary.json', import.meta.url), 'utf8'));
for (const asset of assets) {
  const path = resolve(root, asset.file);
  const before = existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
  if (createHash('sha256').update(before).digest('hex') !== asset.before) throw Error('Asset anchor mismatch ' + asset.file);
}
for (const check of [true, false]) {
  const args = ['apply', ...(check ? ['--check'] : []), patch];
  const result = spawnSync('git', args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const asset of assets) {
  const path = resolve(root, asset.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(asset.content, 'base64'));
}
console.log('Applied ReadEat 1800020', file);
