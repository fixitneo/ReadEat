// Readest Personal: device-local reader controls.
export const PERSONAL_STORAGE_KEY = 'readest-personal-controls-v1';

export const ACTIONS = [
  { id: 'default', label: 'Readest default', icon: '·' },
  { id: 'none', label: 'No action', icon: '×' },
  { id: 'page-prev', label: 'Previous page', icon: '‹' },
  { id: 'page-next', label: 'Next page', icon: '›' },
  { id: 'section-prev', label: 'Previous chapter', icon: '«' },
  { id: 'section-next', label: 'Next chapter', icon: '»' },
  { id: 'toggle-bars', label: 'Show / hide bars', icon: '☰' },
  { id: 'bookmark', label: 'Toggle bookmark', icon: '☆' },
  { id: 'toc', label: 'Table of contents', icon: '☷' },
  { id: 'search', label: 'Search in book', icon: '⌕' },
  { id: 'notes', label: 'Notes / annotations', icon: '✎' },
  { id: 'translation', label: 'Toggle translation', icon: '文' },
  { id: 'settings', label: 'Readest settings', icon: '⚙' },
  { id: 'customize', label: 'Customize bottom bar and touch zones', icon: '☷' },
  { id: 'color', label: 'Appearance', icon: '☼' },
  { id: 'progress', label: 'Reading progress', icon: '━' },
  { id: 'font', label: 'Font and layout', icon: 'A' },
  { id: 'tts', label: 'Read aloud', icon: '♫' },
  { id: 'bookmarks', label: 'Bookmark list', icon: '▤' },
  { id: 'annotations', label: 'Annotation list', icon: '✎' },
  { id: 'single-page', label: 'One page per screen', icon: '▯' },
  { id: 'two-page', label: 'Two pages per screen', icon: '▯▯' },
] as const;
export type PersonalAction = (typeof ACTIONS)[number]['id'];
export type PersonalDock = 'bottom' | 'left' | 'right';
export type FoldMode = 'folded' | 'unfolded';
export interface PersonalLayout {
  toolbar: PersonalAction[];
  touchEnabled: boolean;
  touchZones: PersonalAction[];
  xCuts: [number, number];
  yCuts: [number, number];
}
export interface PersonalControlsConfig extends PersonalLayout {
  version: 2;
  enabled: boolean;
  expanded: boolean;
  dock: PersonalDock;
  size: number;
  opacity: number;
  foldProfiles: Record<FoldMode, PersonalLayout>;
}
export const DEFAULT_LAYOUT: PersonalLayout = {
  toolbar: ['toc', 'color', 'progress', 'font', 'tts', 'customize'],
  touchEnabled: false,
  touchZones: [
    'page-prev','toggle-bars','page-next',
    'page-prev','toggle-bars','page-next',
    'page-prev','toggle-bars','page-next',
  ],
  xCuts: [28, 72],
  yCuts: [30, 70],
};
const copyLayout = (v: PersonalLayout): PersonalLayout => ({
  toolbar: [...v.toolbar], touchEnabled: v.touchEnabled,
  touchZones: [...v.touchZones], xCuts: [...v.xCuts], yCuts: [...v.yCuts],
});
export const DEFAULT_PERSONAL_CONFIG: PersonalControlsConfig = {
  version: 2, enabled: true, expanded: true, dock: 'bottom', size: 44, opacity: 0.92,
  ...copyLayout(DEFAULT_LAYOUT),
  foldProfiles: {
    folded: copyLayout(DEFAULT_LAYOUT),
    unfolded: copyLayout(DEFAULT_LAYOUT),
  },
};
const actionIds = new Set<string>(ACTIONS.map((a) => a.id));
const validAction = (value: unknown): PersonalAction =>
  typeof value === 'string' && actionIds.has(value) ? value as PersonalAction : 'default';
const clamp = (input: unknown, min: number, max: number, fallback: number) =>
  typeof input === 'number' && Number.isFinite(input)
    ? Math.max(min, Math.min(max, input))
    : fallback;
const normalizeCuts = (value: unknown, fallback: [number, number]): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) return [...fallback];
  const first = clamp(value[0], 8, 84, fallback[0]);
  const second = clamp(value[1], first + 8, 92, fallback[1]);
  return [first, second];
};
export const normalizeLayout = (value: unknown, fallback: PersonalLayout = DEFAULT_LAYOUT): PersonalLayout => {
  const obj = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<PersonalLayout> : {};
  return {
    toolbar: Array.isArray(obj.toolbar)
      ? obj.toolbar.slice(0, 16).map(validAction).filter(v => v !== 'none' && v !== 'default')
      : [...fallback.toolbar],
    touchEnabled: typeof obj.touchEnabled === 'boolean' ? obj.touchEnabled : fallback.touchEnabled,
    touchZones: Array.from({ length: 9 }, (_, i) =>
      Array.isArray(obj.touchZones) ? validAction(obj.touchZones[i]) : fallback.touchZones[i]!),
    xCuts: normalizeCuts(obj.xCuts, fallback.xCuts),
    yCuts: normalizeCuts(obj.yCuts, fallback.yCuts),
  };
};

/** Migration: legacy single-layout files become the starting layout for both
 * fold profiles. New files keep the two fully independent. Legacy top-level
 * fields mirror folded mode solely for old exports / original tests. */
export function normalizePersonalConfig(raw: unknown): PersonalControlsConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_PERSONAL_CONFIG, ...copyLayout(DEFAULT_LAYOUT),
      foldProfiles: { folded: copyLayout(DEFAULT_LAYOUT), unfolded: copyLayout(DEFAULT_LAYOUT) } };
  }
  const value = raw as Partial<PersonalControlsConfig>;
  const legacy = normalizeLayout(value);
  const profiles = value.foldProfiles;
  const folded = normalizeLayout(profiles?.folded, legacy);
  const unfolded = normalizeLayout(profiles?.unfolded, legacy);
  return {
    version: 2,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    expanded: typeof value.expanded === 'boolean' ? value.expanded : true,
    dock: value.dock === 'left' || value.dock === 'right' ? value.dock : 'bottom',
    size: clamp(value.size, 36, 60, 44),
    opacity: clamp(value.opacity, 0.5, 1, 0.92),
    ...copyLayout(folded),
    foldProfiles: { folded, unfolded },
  };
}

/** Device geometry in CSS pixels, using screen dimensions to avoid the soft
 * keyboard shrinking the visual viewport and accidentally flipping profiles. */
export function inferFoldMode(
  screenWidth: number, screenHeight: number,
  viewportWidth: number, viewportHeight: number,
): FoldMode {
  const sw = Math.min(screenWidth, screenHeight);
  const vw = Math.min(viewportWidth, viewportHeight);
  if (Number.isFinite(sw) && sw > 0) return sw >= 600 ? 'unfolded' : 'folded';
  return vw >= 600 ? 'unfolded' : 'folded';
}
export function currentFoldMode(): FoldMode {
  if (typeof window === 'undefined') return 'folded';
  return inferFoldMode(window.screen.width, window.screen.height,
    window.innerWidth, window.innerHeight);
}
export function getPersonalLayout(config: PersonalControlsConfig, mode: FoldMode): PersonalLayout {
  return config.foldProfiles[mode];
}
export function updatePersonalLayout(config: PersonalControlsConfig, mode: FoldMode,
  update: Partial<PersonalLayout>): PersonalControlsConfig {
  const next = normalizeLayout({ ...getPersonalLayout(config, mode), ...update });
  const foldProfiles = { ...config.foldProfiles, [mode]: next };
  return normalizePersonalConfig({ ...config, ...foldProfiles.folded, foldProfiles });
}
/** Routes one physical tap using the exact visual reading viewport.
 * The check is shared by reflowable iframes, PDF canvases and PDF text view. */
export function resolveViewportTap(
  config: PersonalControlsConfig,
  point: {x: number; y: number},
  viewport: {left: number; top: number; width: number; height: number},
  mode: FoldMode,
): {action: PersonalAction; zone: number; x: number; y: number} | null {
  if (!viewport.width || !viewport.height || !Number.isFinite(viewport.width) ||
      !Number.isFinite(viewport.height)) return null;
  const x = (point.x - viewport.left) / viewport.width;
  const y = (point.y - viewport.top) / viewport.height;
  const action = resolveTouchAction(config, x, y, mode);
  if (!action) return null;
  const layout = getPersonalLayout(config, mode);
  const col = x < layout.xCuts[0] / 100 ? 0 : x >= layout.xCuts[1] / 100 ? 2 : 1;
  const row = y < layout.yCuts[0] / 100 ? 0 : y >= layout.yCuts[1] / 100 ? 2 : 1;
  return {action, zone: row * 3 + col + 1, x, y};
}
export function resolveTouchAction(config: PersonalControlsConfig, x: number, y: number,
  mode: FoldMode = 'folded'): PersonalAction | null {
  const profile = getPersonalLayout(config, mode);
  if (!config.enabled || !profile.touchEnabled ||
      !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  const col = x < profile.xCuts[0] / 100 ? 0 : x >= profile.xCuts[1] / 100 ? 2 : 1;
  const row = y < profile.yCuts[0] / 100 ? 0 : y >= profile.yCuts[1] / 100 ? 2 : 1;
  const action = profile.touchZones[row * 3 + col];
  return action && action !== 'default' ? action : null;
}

/** Row-major 1..9 index of the actual reading surface; useful for live
 * Android diagnostic mode even when the assigned action is disabled. */
export function getPersonalTouchZone(
  config: PersonalControlsConfig, x: number, y: number, mode: FoldMode,
): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) ||
      x < 0 || x > 1 || y < 0 || y > 1) return null;
  const profile = getPersonalLayout(config, mode);
  const col = x < profile.xCuts[0] / 100 ? 0 : x >= profile.xCuts[1] / 100 ? 2 : 1;
  const row = y < profile.yCuts[0] / 100 ? 0 : y >= profile.yCuts[1] / 100 ? 2 : 1;
  return row * 3 + col + 1;
}
