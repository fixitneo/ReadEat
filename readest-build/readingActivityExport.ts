import type { FileSyncProvider } from '@/services/sync/file/provider';

export type ReadingActivityKind =
  | 'book'
  | 'position'
  | 'favorite'
  | 'bookmark'
  | 'highlight'
  | 'annotation'
  | 'note'
  | 'word';
export interface ReadingActivityRecord {
  id: string;
  bookId: string;
  kind: ReadingActivityKind;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  title?: string;
  text?: string;
  memo?: string;
  location?: { cfi?: string; page?: number; progress?: number };
  tags?: string[];
}
export interface ReadingActivitySnapshot {
  schema: 'reading-activity/v1';
  deviceId: string;
  generatedAt: number;
  records: ReadingActivityRecord[];
}
const kinds = new Set([
  'book',
  'position',
  'favorite',
  'bookmark',
  'highlight',
  'annotation',
  'note',
  'word',
]);
export function makeReadingActivitySnapshot(
  deviceId: string,
  records: ReadingActivityRecord[],
  generatedAt: number,
  previous?: ReadingActivitySnapshot,
): ReadingActivitySnapshot {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(deviceId)) throw Error('Invalid activity device ID');
  if (!Number.isSafeInteger(generatedAt) || generatedAt < 0) throw Error('Invalid activity time');
  const byId = new Map<string, ReadingActivityRecord>();
  for (const source of records) {
    if (
      !source.id ||
      !source.bookId ||
      !kinds.has(source.kind) ||
      !Number.isFinite(source.createdAt) ||
      !Number.isFinite(source.updatedAt)
    )
      throw Error('Invalid activity record');
    if (byId.has(source.id)) throw Error('Duplicate activity record ID');
    // Deliberate allowlist: never spread book/config objects or credentials.
    const record: ReadingActivityRecord = {
      id: source.id,
      bookId: source.bookId,
      kind: source.kind,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
    for (const key of ['title', 'text', 'memo'] as const)
      if (typeof source[key] === 'string') record[key] = source[key];
    if (source.deletedAt !== undefined) record.deletedAt = source.deletedAt;
    if (source.tags) record.tags = [...source.tags];
    if (source.location) {
      const { cfi, page, progress } = source.location;
      record.location = {
        ...(typeof cfi === 'string' ? { cfi } : {}),
        ...(typeof page === 'number' && Number.isFinite(page) ? { page } : {}),
        ...(typeof progress === 'number' && Number.isFinite(progress) ? { progress } : {}),
      };
    }
    byId.set(record.id, record);
  }
  if (previous && previous.deviceId !== deviceId)
    throw Error('Cannot diff activity from a different device');
  for (const old of previous?.records ?? [])
    if (!byId.has(old.id))
      byId.set(old.id, {
        id: old.id,
        bookId: old.bookId,
        kind: old.kind,
        createdAt: old.createdAt,
        updatedAt: old.deletedAt ? old.updatedAt : generatedAt,
        deletedAt: old.deletedAt ?? generatedAt,
      });
  return {
    schema: 'reading-activity/v1',
    deviceId,
    generatedAt,
    records: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
export async function publishReadingActivity(
  provider: FileSyncProvider,
  snapshot: ReadingActivitySnapshot,
) {
  const checked = makeReadingActivitySnapshot(
    snapshot.deviceId,
    snapshot.records,
    snapshot.generatedAt,
  );
  const body = JSON.stringify(checked, null, 2) + '\n';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const sha256 = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  const root = (provider.rootPath === '/' ? '' : provider.rootPath) + '/reading-activity/v1';
  const device = root + '/devices/' + checked.deviceId;
  const file = 'generations/' + checked.generatedAt + '-' + sha256.slice(0, 16) + '.json';
  await provider.ensureDir([root, root + '/devices', device, device + '/generations']);
  // Publish immutable data first. A failed PUT never advances the manifest.
  await provider.writeText(device + '/' + file, body, 'application/json; charset=utf-8');
  await provider.writeText(
    device + '/manifest.json',
    JSON.stringify(
      {
        schema: 'reading-activity-manifest/v1',
        deviceId: checked.deviceId,
        generatedAt: checked.generatedAt,
        file,
        sha256,
        records: checked.records.length,
      },
      null,
      2,
    ) + '\n',
    'application/json; charset=utf-8',
  );
  return { path: device + '/manifest.json', sha256 };
}
