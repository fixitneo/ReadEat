import { useSyncExternalStore } from 'react';
import type { Book } from '@/types/book';

export const STATUS_CATALOG_KEY = 'readest-personal-status-catalog-v1';
export const STATUS_CATALOG_EVENT = 'readest-personal-status-catalog-change';
export const STATUS_TAG_PREFIX = 'ReadestStatus:';
export const FAVORITE_TAG = '★ Favorites';
export const WRITING_TAG = STATUS_TAG_PREFIX + '작성 중';

export const DEFAULT_STATUS_ORDER = [
  'recent', 'read', 'reading', 'unread', 'finished',
  'abandoned', 'favorites', 'writing',
] as const;
export type BuiltinStatus = (typeof DEFAULT_STATUS_ORDER)[number];
export type StatusId = string;
export type Catalog = { version: 1; order: StatusId[]; custom: string[] };
export type ShelfStatus = { id: StatusId; label: string; required: boolean; assignable: boolean };

export const STATUS_LABELS: Record<BuiltinStatus, string> = {
  recent: '최근 읽은 책', read: '읽은 책', reading: '읽는 중',
  unread: '읽지 않음', finished: '완독', abandoned: '보류',
  favorites: '★ 즐겨찾기', writing: '작성 중',
};
const CORE = new Set<string>(DEFAULT_STATUS_ORDER);
const DEFAULT_CATALOG: Catalog = {version: 1, order: [...DEFAULT_STATUS_ORDER], custom: []};
const MAX_CUSTOM = 48;

export function normalizedStatusName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 32 || name.includes(':') || /[\u0000-\u001f]/.test(name)) return null;
  if (Object.values(STATUS_LABELS).some(label => label.replace('★ ', '') === name)
      || name === '즐겨찾기' || name === '작성 중') return null;
  return name;
}

export function readStatusCatalog(value: string | null): Catalog {
  if (!value) return {...DEFAULT_CATALOG, order: [...DEFAULT_CATALOG.order]};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return readStatusCatalog(null);
    const input = parsed as Partial<Catalog>;
    if (input.version !== 1) return readStatusCatalog(null);
    const custom = Array.isArray(input.custom)
      ? Array.from(new Set(input.custom.map(normalizedStatusName).filter((n): n is string => !!n))).slice(0, MAX_CUSTOM)
      : [];
    const customIds = custom.map(name => 'custom:' + name);
    const available = new Set<string>([...DEFAULT_STATUS_ORDER, ...customIds]);
    const order = [
      ...(Array.isArray(input.order) ? input.order.filter(id => typeof id === 'string' && available.has(id)) : []),
      ...DEFAULT_STATUS_ORDER, ...customIds,
    ].filter((id, index, all) => all.indexOf(id) === index);
    return {version: 1, order, custom};
  } catch { return readStatusCatalog(null); }
}

export function mergeCatalogWithBookTags(catalog: Catalog, books: Book[]): Catalog {
  const known = new Set(catalog.custom);
  const additions: string[] = [];
  for (const book of books) {
    if (book.deletedAt) continue;
    for (const tag of book.tags ?? []) {
      if (!tag.startsWith(STATUS_TAG_PREFIX) || tag === WRITING_TAG) continue;
      const name = normalizedStatusName(tag.slice(STATUS_TAG_PREFIX.length));
      if (!name || known.has(name) || catalog.custom.length + additions.length >= MAX_CUSTOM) continue;
      known.add(name); additions.push(name);
    }
  }
  if (!additions.length) return catalog;
  return {version: 1, custom: [...catalog.custom, ...additions],
    order: [...catalog.order, ...additions.map(name => 'custom:' + name)]};
}

export function catalogItems(catalog: Catalog): ShelfStatus[] {
  return catalog.order.map(id => id.startsWith('custom:')
    ? {id, label: id.slice(7), required: false, assignable: true}
    : {id, label: STATUS_LABELS[id as BuiltinStatus], required: CORE.has(id),
      assignable: id !== 'recent' && id !== 'read'});
}

export function appendCustomStatus(catalog: Catalog, rawName: string): Catalog {
  const name = normalizedStatusName(rawName);
  if (!name) throw new Error('상태 이름은 1~32자여야 하며 기본 상태와 중복될 수 없습니다.');
  if (catalog.custom.includes(name)) return catalog;
  if (catalog.custom.length >= MAX_CUSTOM) throw new Error('사용자 상태는 최대 48개까지 추가할 수 있습니다.');
  return {...catalog, custom: [...catalog.custom, name], order: [...catalog.order, 'custom:' + name]};
}
export function removeCustomStatus(catalog: Catalog, id: StatusId): Catalog {
  if (!id.startsWith('custom:') || CORE.has(id)) return catalog;
  return {...catalog, custom: catalog.custom.filter(name => 'custom:' + name !== id),
    order: catalog.order.filter(other => other !== id)};
}
export function reorderStatuses(catalog: Catalog, from: StatusId, to: StatusId): Catalog {
  const order = [...catalog.order];
  const a = order.indexOf(from), b = order.indexOf(to);
  if (a < 0 || b < 0 || a === b) return catalog;
  order.splice(a, 1); order.splice(b, 0, from);
  return {...catalog, order};
}

export function matchesPersonalStatus(book: Book, id: StatusId): boolean {
  if (book.deletedAt) return false;
  const tags = book.tags ?? [];
  if (id === 'favorites') return tags.includes(FAVORITE_TAG);
  const assigned = tags.find(tag => tag.startsWith(STATUS_TAG_PREFIX));
  if (id === 'writing') return assigned === WRITING_TAG;
  if (id.startsWith('custom:')) return assigned === STATUS_TAG_PREFIX + id.slice(7);
  if (id === 'recent') return true;
  if (id === 'read') return book.readingStatus !== 'unread' &&
    (book.readingStatus === 'finished' || book.readingStatus === 'reading' || !!book.progress?.[0]);
  if (assigned) return false;
  if (id === 'unread') return book.readingStatus === 'unread' ||
    (!book.readingStatus && !book.progress?.[0]);
  if (id === 'reading') return book.readingStatus === 'reading' ||
    (!book.readingStatus && !!book.progress?.[0]);
  return book.readingStatus === id;
}
const getSnapshot = () => typeof localStorage === 'undefined' ? '' : (localStorage.getItem(STATUS_CATALOG_KEY) ?? '');
const getServerSnapshot = () => '';
const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const storage = (event: StorageEvent) => { if (event.key === STATUS_CATALOG_KEY) callback(); };
  window.addEventListener('storage', storage);
  window.addEventListener(STATUS_CATALOG_EVENT, callback);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(STATUS_CATALOG_EVENT, callback);
  };
};
export function usePersonalStatusCatalog(books: Book[]) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return mergeCatalogWithBookTags(readStatusCatalog(snapshot), books);
}
export function persistStatusCatalog(next: Catalog) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATUS_CATALOG_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(STATUS_CATALOG_EVENT));
}
