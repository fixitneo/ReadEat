#!/usr/bin/env node
// Personal Readest patch, upstream v0.12.16 (AGPL-3.0)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const app = path.join(root, 'apps/readest-app');
const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
if (pkg.version !== '0.12.16') throw new Error('Expected upstream v0.12.16');
function patch(filename, before, after) {
  const data = fs.readFileSync(filename, 'utf8');
  if (data.includes(after) && !data.includes(before)) return;
  if (data.split(before).length !== 2) throw new Error('Expected one match: ' + filename);
  fs.writeFileSync(filename, data.replace(before, after));
}
patch(path.join(app, 'src/utils/access.ts'),
  'export const CLOUD_SYNC_REQUIRES_PREMIUM = true;',
  'export const CLOUD_SYNC_REQUIRES_PREMIUM = false;');
// Enable only local / personal API powered features for this open-source fork.
// Hosted quota / cloud storage / subscription-controlled API permissions remain
// enforced by their servers and are NOT represented as "unlocked" here.
const accessPath = path.join(app, 'src/utils/access.ts');
patch(accessPath, "export const isCustomTranslatorAllowed = (token: string | null | undefined): boolean =>\n  token\n    ? isCustomizationAllowed(getUserProfilePlan(token), getCustomizationPurchased(token))\n    : isSelfHosted();", "// Personal-device custom LLM translators call a user-selected API directly.\n// Does not mint a subscription, unlock Readest-hosted endpoints or grant quota.\nexport const isCustomTranslatorAllowed = (_token: string | null | undefined): boolean => true;");
patch(accessPath,
  'export const TTS_CACHE_REQUIRES_PREMIUM = true;',
  'export const TTS_CACHE_REQUIRES_PREMIUM = false;');
patch(accessPath,
  'export const ABS_OFFLINE_REQUIRES_PREMIUM = true;',
  'export const ABS_OFFLINE_REQUIRES_PREMIUM = false;');
patch(accessPath,
  'export const NEARBY_PAIRING_REQUIRES_PREMIUM = true;',
  'export const NEARBY_PAIRING_REQUIRES_PREMIUM = false;');

const cfg = path.join(app, 'src-tauri/tauri.conf.json');
patch(cfg, '"productName": "Readest",', '"productName": "Readest Personal",');
patch(cfg, '"identifier": "com.bilingify.readest",',
  '"identifier": "com.fixitneo.readestpersonal",');
JSON.parse(fs.readFileSync(cfg, 'utf8'));
fs.writeFileSync(path.join(app, '.env.tauri'), 'NEXT_PUBLIC_APP_PLATFORM=tauri\n');
console.log('Readest Personal patch applied');


const personalControlsDir = path.dirname(new URL(import.meta.url).pathname);
fs.copyFileSync(
  path.join(personalControlsDir, 'personalControlsConfig.ts'),
  path.join(app, 'src/utils/personalControlsConfig.ts'),
);
fs.copyFileSync(
  path.join(personalControlsDir, 'PersonalControls.tsx'),
  path.join(app, 'src/app/reader/components/PersonalControls.tsx'),
);
fs.copyFileSync(
  path.join(personalControlsDir, 'PersonalFooterBar.tsx'),
  path.join(app, 'src/app/reader/components/PersonalFooterBar.tsx'),
);
const nav = path.join(app, 'src/app/reader/components/footerbar/NavigationBar.tsx');
patch(
  nav,
  "import Button from '@/components/Button';",
  "import Button from '@/components/Button';\nimport { PersonalFooterBar } from '../PersonalFooterBar';",
);
patch(
  nav,
  "      {isSideBarVisible && isSideBarPinned ? null : (",
  "      {appService?.isAndroidApp ? (\n        <PersonalFooterBar bookKey={bookKey} actionTab={actionTab} onSetActionTab={onSetActionTab} />\n      ) : (\n        <>\n      {isSideBarVisible && isSideBarPinned ? null : (",
);
patch(
  nav,
  "        onClick={() => onSetActionTab('tts')}\n      />\n    </div>",
  "        onClick={() => onSetActionTab('tts')}\n      />\n        </>\n      )}\n    </div>",
);

const reader = path.join(app, 'src/app/reader/components/Reader.tsx');
patch(
  reader,
  "import ReaderContent from './ReaderContent';",
  "import ReaderContent from './ReaderContent';\nimport PersonalControls from './PersonalControls';",
);
patch(
  reader,
  "        <ReaderContent ids={ids} settings={settings} />",
  "        <ReaderContent ids={ids} settings={settings} />\n        <PersonalControls />",
);
const pagination = path.join(app, 'src/app/reader/hooks/usePagination.ts');
patch(
  pagination,
  "import { useTouchInterceptor } from './useTouchInterceptor';",
  "import { useTouchInterceptor } from './useTouchInterceptor';\nimport { normalizePersonalConfig, resolveViewportTap, currentFoldMode } from '@/utils/personalControlsConfig';",
);
patch(
  pagination,
  "            if (!consumed) {",
  `            // Unify the real iframe viewport with PDF's main-window hit test.
            // windowX/windowY already account for nested iframe transformations.
            const mode = currentFoldMode();
            const personalTap = !consumed && appService?.isAndroidApp && !msg.data.media
              ? resolveViewportTap(
                  normalizePersonalConfig(useSettingsStore.getState().settings.personalControls),
                  { x: msg.data.windowX, y: msg.data.windowY }, viewRect, mode,
                )
              : null;
            if (personalTap) {
              void eventDispatcher.dispatch('personal-control-action', {
                ...personalTap, bookKey, mode, source: 'epub-iframe',
              });
              return;
            }
            if (!consumed) {`,
);


patch(
  pagination,
  "      if (msg.type === 'click') {\n        const { clientX } = msg;",
  `      if (msg.type === 'click') {
        // Fixed-layout PDF/canvas pages use main-document clicks, unlike EPUB
        // iframes. Previously the 3x3 map never ran on this input path.
        const target = msg.target as HTMLElement | null;
        const interactive = target?.closest?.(
          'a, button, input, textarea, select, [role="button"], [contenteditable="true"]',
        );
        const selection = window.getSelection();
        const rect = containerRef.current?.getBoundingClientRect();
        const mode = currentFoldMode();
        const personalTap = appService?.isAndroidApp && !interactive && !msg.altKey &&
          !msg.ctrlKey && !msg.metaKey && (!selection || selection.isCollapsed) &&
          rect && msg.button === 0
          ? resolveViewportTap(
              normalizePersonalConfig(useSettingsStore.getState().settings.personalControls),
              { x: msg.clientX, y: msg.clientY }, rect, mode,
            )
          : null;
        if (personalTap) {
          void eventDispatcher.dispatch('personal-control-action', {
            ...personalTap, bookKey, mode, source: 'reader-container',
          });
          msg.stopPropagation();
          return;
        }
        const { clientX } = msg;`,
);

// Map ebook iframe taps to the parent viewport; screenY is not stable when
// Android system bars appear/disappear or a foldable changes window geometry.
// v0.12.16 already adds ...getWindowPoint(event) to iframe-single-click.
const settingsType = path.join(app, 'src/types/settings.ts');
patch(
  settingsType,
  'export interface SystemSettings {',
  "export interface SystemSettings {\n  personalControls?: import('@/utils/personalControlsConfig').PersonalControlsConfig;",
);
const defaults = path.join(app, 'src/services/constants.ts');
// Use the same versioned defaults everywhere, including native settings,
// backup, and settings replica sync. Do not create a v1 literal here.
patch(
  defaults,
  'export const DEFAULT_SYSTEM_SETTINGS: Partial<SystemSettings> = {',
  "export const DEFAULT_SYSTEM_SETTINGS: Partial<SystemSettings> = {\n  personalControls: DEFAULT_PERSONAL_CONFIG,",
);
patch(
  defaults,
  "import { DEFAULT_ANNOTATION_TOOLBAR_ITEMS } from '@/utils/annotationToolbar';",
  "import { DEFAULT_ANNOTATION_TOOLBAR_ITEMS } from '@/utils/annotationToolbar';\nimport { DEFAULT_PERSONAL_CONFIG } from '@/utils/personalControlsConfig';",
);
const adapter = path.join(app, 'src/services/sync/adapters/settings.ts');
patch(
  adapter,
  'export const SETTINGS_WHITELIST = [',
  "export const SETTINGS_WHITELIST = [\n  'personalControls',",
);
const windowSync = path.join(app, 'src/utils/settingsSync.ts');
patch(
  windowSync,
  'export interface SettingsSyncPayload {',
  "export interface SettingsSyncPayload {\n  personalControls?: SystemSettings['personalControls'];",
);
patch(
  windowSync,
  "    'globalViewSettings' | 'globalReadSettings' | 'cloudSyncProviders' | 'bookshelves'",
  "    'globalViewSettings' | 'globalReadSettings' | 'cloudSyncProviders' | 'bookshelves' | 'personalControls'",
);
patch(
  windowSync,
  '    globalViewSettings: payload.globalViewSettings,',
  '    globalViewSettings: payload.globalViewSettings,\n    personalControls: payload.personalControls ?? local.personalControls,',
);
patch(
  windowSync,
  '      globalViewSettings: settings.globalViewSettings,',
  '      globalViewSettings: settings.globalViewSettings,\n      personalControls: settings.personalControls,',
);



const readerHeader = path.join(app, 'src/app/reader/components/HeaderBar.tsx');
patch(
  readerHeader,
  "          <WindowButtons\n            className='window-buttons flex items-center'",
  "          {!appService?.isMobileApp && <WindowButtons\n            className='window-buttons flex items-center'",
);
patch(
  readerHeader,
  "              onCloseBook(bookKey);\n            }}\n          />",
  "              onCloseBook(bookKey);\n            }}\n          />}",
);
// On foldables the CSS 640px breakpoint changes after unfolding; the
// appService.isMobileApp condition remains stable across both modes.
const sidebar = path.join(app, 'src/app/reader/components/sidebar/SideBar.tsx');
patch(
  sidebar,
  "const MAX_SIDEBAR_WIDTH = 0.45;",
  "const MAX_SIDEBAR_WIDTH = 0.90;",
);
patch(
  sidebar,
  "  const isMobile = window.innerWidth < 640;",
  "  const isMobile = window.innerWidth < 640;\n  const isPersonalTablet = appService?.isAndroidApp && !isMobile;",
);
patch(
  sidebar,
  "          width: isMobile ? '100%' : \`\${sideBarWidth}\`,\n          maxWidth: isMobile ? '100%' : \`\${MAX_SIDEBAR_WIDTH * 100}%\`,",
  "          width: isMobile ? '100%' : isPersonalTablet ? 'min(90vw, 100%)' : \`\${sideBarWidth}\`,\n          maxWidth: isMobile ? '100%' : \`\${MAX_SIDEBAR_WIDTH * 100}%\`,",
);

const sidebarContent = path.join(app, 'src/app/reader/components/sidebar/Content.tsx');
patch(
  sidebarContent,
  "  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);",
  "  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const swipeStart = useRef<{ x: number; y: number } | null>(null);",
);
patch(
  sidebarContent,
  "  return (\n    <>\n      <div\n        className={clsx(\n          'sidebar-content",
  `  const startSidebarSwipe = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    swipeStart.current = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
  };
  const endSidebarSwipe = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0]!.clientX - start.x;
    const dy = event.changedTouches[0]!.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const tabs = ['toc', 'annotations', 'bookmarks', ...(aiEnabled ? ['history'] : [])];
    const index = tabs.indexOf(activeTab);
    const next = tabs[index + (dx < 0 ? 1 : -1)];
    if (next) handleTabChange(next);
  };

  return (
    <>
      <div
        onTouchStart={startSidebarSwipe}
        onTouchEnd={endSidebarSwipe}
        className={clsx(
          'sidebar-content`,
);

fs.copyFileSync(
  path.join(personalControlsDir, 'personalControls.test.ts'),
  path.join(app, 'src/__tests__/personalControls.test.ts'),
);
