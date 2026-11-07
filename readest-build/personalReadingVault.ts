// Readest Personal device-local, cross-book reading vault.
// Versioned, bounded data; failed writes never silently discard existing notes.
export const READING_VAULT_KEY = 'readest-personal-reading-vault-v1';
export const READING_VAULT_CHANGED = 'readest-personal-reading-vault-changed';
export type ReadingVaultKind = 'word' | 'note';
export interface ReadingVaultEntry {
  id: string;
  kind: ReadingVaultKind;
  text: string;
  memo: string;
  bookId: string;
  bookTitle: string;
  quote?: string;
  cfi?: string;
  createdAt: number;
  updatedAt: number;
}
interface VaultDocument { version: 1; entries: ReadingVaultEntry[] }
const MAX_VAULT_BYTES = 1_500_000;
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
function validatedDocument(raw: unknown): VaultDocument {
  if (!isRecord(raw) || raw['version'] !== 1 || !Array.isArray(raw['entries']))
    throw new Error('단어장·노트 저장 형식이 올바르지 않습니다. 기존 자료는 보존됩니다.');
  if (raw['entries'].length > 10000)
    throw new Error('단어장·노트의 항목 수가 비정상적으로 많습니다.');
  const entries: ReadingVaultEntry[] = [];
  for (const entry of raw['entries']) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' ||
        (entry['kind'] !== 'word' && entry['kind'] !== 'note') ||
        typeof entry['text'] !== 'string' || typeof entry['memo'] !== 'string' ||
        typeof entry['bookId'] !== 'string' || typeof entry['bookTitle'] !== 'string' ||
        typeof entry['createdAt'] !== 'number' || typeof entry['updatedAt'] !== 'number' ||
        (entry['quote'] !== undefined && typeof entry['quote'] !== 'string') ||
        (entry['cfi'] !== undefined && typeof entry['cfi'] !== 'string')) {
      throw new Error('단어장·노트 저장 데이터가 손상됐습니다. 복원 또는 수동 백업을 확인하세요.');
    }
    entries.push(entry as unknown as ReadingVaultEntry);
  }
  return { version: 1, entries };
}
export function readReadingVault(): ReadingVaultEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(READING_VAULT_KEY);
  if (raw === null) return [];
  try { return validatedDocument(JSON.parse(raw)).entries; }
  catch (error) {
    throw new Error(error instanceof Error ? error.message : '단어장·노트 읽기 실패');
  }
}
function writeReadingVault(entries: ReadingVaultEntry[]): void {
  if (typeof localStorage === 'undefined') throw new Error('이 환경에서는 저장할 수 없습니다.');
  const raw = JSON.stringify({ version: 1, entries });
  if (new Blob([raw]).size > MAX_VAULT_BYTES)
    throw new Error('단어장·노트 저장 용량에 도달했습니다. 백업한 후 오래된 항목을 정리하세요.');
  // setItem is atomic for this document, and throws on quota failure.
  localStorage.setItem(READING_VAULT_KEY, raw);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(READING_VAULT_CHANGED));
}
const limit = (x: string, max: number) => x.trim().slice(0, max);
export function saveReadingVaultEntry(input: {
  kind: ReadingVaultKind; text: string; memo?: string;
  bookId: string; bookTitle: string; quote?: string; cfi?: string;
}): ReadingVaultEntry {
  const text = limit(input.text, input.kind === 'word' ? 250 : 4000);
  if (!text) throw new Error(input.kind === 'word' ? '선택된 단어가 없습니다.' : '노트 제목을 입력하세요.');
  const entries = readReadingVault();
  const now = Date.now();
  // Re-selecting the same word in the same book opens one entry, rather
  // than consuming quota with accidental duplicates. Other books retain
  // their own references to the same word.
  const previous = input.kind === 'word' ? entries.find(e =>
    e.kind === 'word' && e.bookId === input.bookId &&
    e.text.normalize('NFKC').toLocaleLowerCase() === text.normalize('NFKC').toLocaleLowerCase()) : undefined;
  const record: ReadingVaultEntry = {
    id: previous?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID() : `vault-${now}-${Math.random().toString(36).slice(2)}`),
    kind: input.kind, text, memo: limit(input.memo ?? previous?.memo ?? '', 5000),
    bookId: limit(input.bookId, 150), bookTitle: limit(input.bookTitle || '제목 없음', 300),
    quote: limit(input.quote ?? previous?.quote ?? '', 1500),
    cfi: limit(input.cfi ?? previous?.cfi ?? '', 1000),
    createdAt: previous?.createdAt ?? now, updatedAt: now,
  };
  writeReadingVault([...entries.filter(e => e.id !== record.id), record]);
  return record;
}
export function updateReadingVaultMemo(id: string, memo: string): void {
  const entries = readReadingVault();
  if (!entries.some(e => e.id === id)) throw new Error('해당 노트가 없습니다.');
  writeReadingVault(entries.map(e => e.id === id
    ? { ...e, memo: limit(memo, 5000), updatedAt: Date.now() } : e));
}
export function removeReadingVaultEntry(id: string): void {
  const entries = readReadingVault();
  writeReadingVault(entries.filter(e => e.id !== id));
}
export function sortReadingVault(entries: ReadingVaultEntry[], order: 'az' | 'new' | 'old'): ReadingVaultEntry[] {
  return [...entries].sort((a, b) => order === 'az'
    ? collator.compare(a.text, b.text) || b.createdAt - a.createdAt
    : order === 'new' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
}
// Backup uses a separate, validated snapshot; import does not overwrite
// a newer local edit with an older copy of the same entry.
export function mergeReadingVaultBackup(raw: string): void {
  if (new Blob([raw]).size > MAX_VAULT_BYTES) throw new Error('단어장 백업이 허용 크기를 초과합니다.');
  const snapshot = validatedDocument(JSON.parse(raw));
  const existing = readReadingVault();
  const byId = new Map(existing.map(e => [e.id, e]));
  for (const entry of snapshot.entries) {
    const prev = byId.get(entry.id);
    if (!prev || entry.updatedAt > prev.updatedAt) byId.set(entry.id, entry);
  }
  writeReadingVault([...byId.values()]);
}
