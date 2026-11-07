// Portable, category-selective Readest Personal backups.
import type { BookConfig, BookNote } from '@/types/book';
import type { SystemSettings } from '@/types/settings';

export interface PersonalBackupSelection {
  bookFiles: boolean;
  serverBooks: boolean;
  bookmarks: boolean;
  annotations: boolean;
  notes: boolean;
  readingPositions: boolean;
  css: boolean;
  layouts: boolean;
  serverSettings: boolean;
  appSettings: boolean;
  statistics: boolean;
  credentials: boolean;
}

export const DEFAULT_PERSONAL_BACKUP: PersonalBackupSelection = {
  bookFiles: true, serverBooks: false,
  bookmarks: true, annotations: true, notes: true, readingPositions: true,
  css: true, layouts: true, serverSettings: true, appSettings: true,
  statistics: true, credentials: false,
};
export const PERSONAL_BACKUP_MANIFEST = 'readest-personal-manifest.json';
export const PERSONAL_BACKUP_STORAGE = 'readest-personal-storage.json';
export const PERSONAL_BACKUP_VERSION = 1;
export const PERSONAL_BACKUP_KEYS = Object.keys(DEFAULT_PERSONAL_BACKUP) as (keyof PersonalBackupSelection)[];
export function normalizeBackupSelection(value: unknown): PersonalBackupSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup selection');
  const src = value as Record<string, unknown>;
  if (PERSONAL_BACKUP_KEYS.some((key) => typeof src[key] !== 'boolean'))
    throw new Error('Incomplete backup selection');
  return Object.fromEntries(PERSONAL_BACKUP_KEYS.map(key => [key, src[key]])) as unknown as PersonalBackupSelection;
}
export function readPersonalManifest(data: unknown): PersonalBackupSelection {
  const value = data as {kind?: unknown; version?: unknown; selection?: unknown} | null;
  if (!value || value.kind !== 'readest-personal-backup' || value.version !== PERSONAL_BACKUP_VERSION)
    throw new Error('Unsupported Readest Personal backup format');
  return normalizeBackupSelection(value.selection);
}
export function makePersonalManifest(selection: PersonalBackupSelection) {
  return JSON.stringify({
    kind: 'readest-personal-backup', version: PERSONAL_BACKUP_VERSION,
    createdAt: new Date().toISOString(), selection,
  }, null, 2);
}

const SERVER_KEYS = [
  'kosync', 'bookorbit', 'readwise', 'hardcover', 'pagebound', 'notion',
  'readestCloud', 'webdav', 'googleDrive', 's3', 'onedrive', 'icloud',
  'opdsCatalogs', 'absServers', 'cloudSyncProviders', 'syncCategories',
];
const LAYOUT_KEYS = [
  'globalReadSettings', 'globalViewSettings', 'personalControls',
  'libraryViewMode','librarySortBy','librarySortAscending','librarySortByAuto',
  'libraryThenSortBy','libraryThenSortAscending','libraryGroupBy',
  'libraryCoverFit','libraryAutoColumns','libraryColumns',
  'librarySkeuomorphicCovers','libraryHideCovers','libraryRecentShelfEnabled',
  'libraryBackgroundTextureId','libraryBackgroundOpacity','libraryBackgroundSize',
  'bookshelves',
];
const CSS_KEYS = ['userStylesheet','userUIStylesheet'];
const SECRET_PATHS = [
  'webdav.password', 'kosync.password', 'kosync.userkey',
  'bookorbit.password', 'bookorbit.userkey', 's3.accessKeyId','s3.secretAccessKey',
  'readwise.accessToken','hardcover.accessToken','hardcover.oauth',
  'pagebound.refreshToken','pagebound.apiToken','notion.accessToken',
  'aiSettings.aiGatewayApiKey','aiSettings.openrouterApiKey',
  'pinCodeHash','pinCodeSalt',
];
function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
function dropPath(x: Record<string, unknown>, path: string) {
  const parts = path.split('.');
  let obj = x;
  for (const part of parts.slice(0,-1)) {
    const next = obj[part];
    if (!isObject(next)) return;
    obj = next;
  }
  delete obj[parts[parts.length-1]!];
}
function selectCSSFields(source: unknown, css: boolean, layout: boolean) {
  if (!isObject(source)) return undefined;
  if (!css && !layout) return undefined;
  const obj = structuredClone(source);
  if (!layout) {
    for (const key of Object.keys(obj)) if (!CSS_KEYS.includes(key)) delete obj[key];
  }
  if (!css) for (const key of CSS_KEYS) delete obj[key];
  return obj;
}
export function filterPersonalSettings(
  sanitized: SystemSettings,
  choice: PersonalBackupSelection,
): Partial<SystemSettings> {
  const all = structuredClone(sanitized) as unknown as Record<string, unknown>;
  const output: Record<string, unknown> = choice.appSettings ? all : {};
  if (choice.serverSettings) {
    for (const key of SERVER_KEYS) if (key in all) output[key] = all[key];
  } else for (const key of SERVER_KEYS) delete output[key];
  if (choice.layouts) {
    for (const key of LAYOUT_KEYS) if (key in all) output[key] = all[key];
  } else for (const key of LAYOUT_KEYS) delete output[key];
  const view = selectCSSFields(all['globalViewSettings'], choice.css, choice.layouts);
  if (view) output['globalViewSettings'] = view;
  if (!choice.css && choice.layouts && isObject(output['globalViewSettings']))
    for (const key of CSS_KEYS) delete (output['globalViewSettings'] as Record<string, unknown>)[key];
  if (!choice.credentials) {
    for (const key of SECRET_PATHS) dropPath(output, key);
    // The baseline sanitizer already removes credentials in OPDS/ABS/translators.
    if ('pinCodeEnabled' in output) output['pinCodeEnabled'] = false;
    if ('biometricUnlockEnabled' in output) output['biometricUnlockEnabled'] = false;
  }
  return output as Partial<SystemSettings>;
}
function noteIncluded(note: BookNote, choice: PersonalBackupSelection) {
  if (note.type === 'bookmark') return choice.bookmarks;
  if (note.type === 'annotation' || note.type === 'ink') return choice.annotations;
  return choice.notes;
}
export function filterPersonalBookConfig(
  original: Partial<BookConfig>, choice: PersonalBackupSelection,
): Partial<BookConfig> {
  const output: Partial<BookConfig> = {updatedAt: original.updatedAt ?? Date.now()};
  if (choice.readingPositions) for (const key of ['progress','location','xpointer','rsvpPosition'] as const) {
    // Deliberately keep the source's exact shape.
    if (original[key] !== undefined) Object.assign(output, {[key]: original[key]});
  }
  if (choice.notes || choice.bookmarks || choice.annotations) {
    output.booknotes = (original.booknotes ?? []).filter(note => noteIncluded(note, choice));
  }
  const view = selectCSSFields(original.viewSettings, choice.css, choice.layouts);
  if (view) output.viewSettings = view as BookConfig['viewSettings'];
  if (choice.layouts) {
    for (const key of ['searchConfig','widePages','panX','audiobook'] as const)
      if (original[key] !== undefined) Object.assign(output, {[key]: original[key]});
  }
  return output;
}
export function mergePersonalBookConfig(
  existing: Partial<BookConfig>, backup: Partial<BookConfig>,
  choice: PersonalBackupSelection,
): Partial<BookConfig> {
  const next: Partial<BookConfig> = {...existing};
  if (choice.readingPositions) {
    for (const key of ['progress','location','xpointer','rsvpPosition'] as const)
      if (backup[key] !== undefined) Object.assign(next, {[key]: backup[key]});
  }
  if (choice.notes || choice.bookmarks || choice.annotations) {
    const merged = new Map<string, BookNote>();
    for (const note of existing.booknotes ?? []) merged.set(note.id, note);
    for (const note of backup.booknotes ?? []) {
      if (!noteIncluded(note, choice)) continue;
      const prev = merged.get(note.id);
      if (!prev || (note.updatedAt ?? 0) > (prev.updatedAt ?? 0)) merged.set(note.id, note);
    }
    next.booknotes = [...merged.values()];
  }
  if (choice.layouts) {
    for (const key of ['searchConfig','widePages','panX','audiobook'] as const)
      if (backup[key] !== undefined) Object.assign(next, {[key]: backup[key]});
  }
  if (backup.viewSettings && (choice.layouts || choice.css)) {
    const oldView = isObject(existing.viewSettings) ? existing.viewSettings : {};
    next.viewSettings = {...oldView, ...backup.viewSettings};
  }
  next.updatedAt = Math.max(existing.updatedAt ?? 0, backup.updatedAt ?? 0, Date.now());
  return next;
}
const PERSONAL_KEYS = [
  'readest-personal-css-profiles-book',
  'readest-personal-css-profiles-reader',
  'readest-personal-page-sounds-v1',
  'readest-personal-shelf-filter',
  'readest-personal-status-catalog-v1',
  'readest-personal-ai-templates-v1',
];
export function exportPersonalLocalStorage(choice: PersonalBackupSelection): Record<string,string> {
  if (typeof localStorage === 'undefined') return {};
  const result: Record<string,string> = {};
  for (const key of PERSONAL_KEYS) {
    if (key.includes('css-profiles') ? !choice.css :
        key.includes('page-sounds') || key.includes('shelf-filter') ||
        key.includes('status-catalog') || key.includes('ai-templates') ? !choice.appSettings : true) continue;
    const value = localStorage.getItem(key);
    if (value !== null) result[key] = value;
  }
  return result;
}
export function importPersonalLocalStorage(
  stored: unknown, choice: PersonalBackupSelection,
): void {
  if (!isObject(stored) || typeof localStorage === 'undefined') return;
  for (const key of PERSONAL_KEYS) {
    if (key.includes('css-profiles') ? !choice.css : !choice.appSettings) continue;
    const value = stored[key];
    if (typeof value !== 'string' || value.length > 1_048_576) continue;
    if (key.includes('css-profiles') || key.includes('page-sounds') ||
        key.includes('status-catalog') || key.includes('ai-templates')) {
      try { JSON.parse(value); } catch { continue; }
    }
    localStorage.setItem(key, value);
  }
}
