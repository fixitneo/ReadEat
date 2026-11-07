import { dispatchTouchInterceptors } from '@/app/reader/hooks/useTouchInterceptor';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { useReaderStore } from '@/store/readerStore';
import { ttsSessionManager } from '@/services/tts/TTSSessionManager';
import type { FoliateView } from '@/types/view';
import {
  PersonalPageTurnSound,
  normalizePageSoundConfig,
  DEFAULT_PAGE_SOUNDS,
  PAPER_SOUNDS,
  pageSoundPosition,
  shouldSoundPageTurn,
} from '@/components/settings/PersonalPageTurnSound';
import { settingsAdapter, SETTINGS_WHITELIST } from '@/services/sync/adapters/settings';
import {
  MAX_PERSONAL_PROFILE_BYTES,
  validatePersonalProfileBudget,
  personalProfileBytes,
} from '@/utils/personalProfileBudget';
import type { SystemSettings } from '@/types/settings';
import { filterPersonalSettings, DEFAULT_PERSONAL_BACKUP } from '@/utils/personalBackupSelection';

describe('Readest Personal settings sync and recorded page sound', () => {
  it('requires a real changed page and a manual page/snap reason', () => {
    const before = pageSoundPosition({
      location: { current: 4, total: 90 },
      section: { current: 2 },
    });
    const after = pageSoundPosition({
      location: { current: 5, total: 90 },
      section: { current: 2 },
    });
    expect(before).toBe('2:4');
    expect(after).toBe('2:5');
    expect(pageSoundPosition({ cfi: 'epubcfi(...)' })).toBeNull();
    expect(shouldSoundPageTurn(before, after, 'page', true, true, false)).toBe(true);
    expect(shouldSoundPageTurn(before, after, 'snap', true, true, false)).toBe(true);
    expect(shouldSoundPageTurn(before, before, 'snap', true, true, false)).toBe(false);
    for (const reason of ['anchor', 'navigation', 'scroll', 'selection', null])
      expect(shouldSoundPageTurn(before, after, reason, true, true, false)).toBe(false);
  });
  it('never plays for inactive screen, app switch or narration follow', () => {
    const a = '0:11',
      b = '0:12';
    expect(shouldSoundPageTurn(a, b, 'page', false, true, false)).toBe(false);
    expect(shouldSoundPageTurn(a, b, 'page', true, false, false)).toBe(false);
    expect(shouldSoundPageTurn(a, b, 'page', true, true, true)).toBe(false);
    expect(shouldSoundPageTurn(null, b, 'page', true, true, false)).toBe(false);
  });

  it('three recorded samples are available with default volume', () => {
    expect(PAPER_SOUNDS.map((s) => s.id)).toEqual(['paper', 'book', 'soft']);
    expect(DEFAULT_PAGE_SOUNDS.volume).toBe(75);
  });
  it('retains enabled, sound and clamped fixed volume', () => {
    const config = normalizePageSoundConfig({ enabled: true, selected: 'book', volume: 160 });
    expect(config).toMatchObject({ enabled: true, selected: 'book', volume: 100 });
    expect(normalizePageSoundConfig({ ...config, volume: -3 }).volume).toBe(0);
  });
  it('allows bounded user sound data but rejects executable remote URLs', () => {
    const file = { id: 'abc123', name: 'paper.mp3', data: 'data:audio/mpeg;base64,YQ==' };
    expect(
      normalizePageSoundConfig({ enabled: true, selected: 'abc123', files: [file] }).files,
    ).toHaveLength(1);
    expect(
      normalizePageSoundConfig({
        enabled: true,
        selected: 'evil',
        files: [{ ...file, id: 'evil', data: 'https://example.org/tracker' }],
      }).files,
    ).toHaveLength(0);
  });
  it('refuses to save oversized personal settings blobs that exceed server limits', () => {
    expect(MAX_PERSONAL_PROFILE_BYTES).toBeLessThan(64 * 1024);
    expect(personalProfileBytes({ aiTemplates: [{ body: 'small' }] })).toBeLessThan(
      MAX_PERSONAL_PROFILE_BYTES,
    );
    expect(() =>
      validatePersonalProfileBudget({ aiTemplates: [{ body: 'X'.repeat(30000) }] }),
    ).toThrow('동기화 용량 제한');
  });
  it('roundtrips both settings through the official server replica adapter', () => {
    const profile = {
      pageSounds: normalizePageSoundConfig({ enabled: true, selected: 'soft', volume: 85 }),
      aiTemplates: [{ id: 'mine', name: '질문', scope: 'quote' as const, body: '{title}: {text}' }],
    };
    expect(SETTINGS_WHITELIST).toContain('personalProfile');
    expect(SETTINGS_WHITELIST).toContain('aiSettings.ollamaBaseUrl');
    expect(SETTINGS_WHITELIST).toContain('aiSettings.provider');
    expect(settingsAdapter.encryptedFields).toContain('aiSettings.aiGatewayApiKey');
    expect(settingsAdapter.encryptedFields).toContain('aiSettings.openrouterApiKey');
    const fields = settingsAdapter.pack({ name: 'singleton', patch: { personalProfile: profile } });
    expect(fields['personalProfile']).toEqual(profile);
    const roundtrip = settingsAdapter.unpack(fields);
    expect(roundtrip.patch.personalProfile).toEqual(profile);
    const backed = filterPersonalSettings(
      { personalProfile: profile } as SystemSettings,
      DEFAULT_PERSONAL_BACKUP,
    );
    expect(backed.personalProfile).toEqual(profile);
  });
});

const monitorPlatform = vi.hoisted(() => ({ android: false }));
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({
    envConfig: {},
    appService: {
      get isAndroidApp() {
        return monitorPlatform.android;
      },
    },
  }),
}));
describe('page sound monitor lifecycle', () => {
  const bookKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1';
  const play = vi.fn(() => Promise.resolve());
  let view: EventTarget & { renderer: EventTarget };
  let visible: DocumentVisibilityState;
  let focused: boolean;
  const commit = () =>
    view.dispatchEvent(
      new CustomEvent('readest-personal-page-commit', { detail: { before: '0:0', after: '0:1' } }),
    );
  beforeEach(() => {
    play.mockClear();
    visible = 'visible';
    focused = true;
    monitorPlatform.android = false;
    vi.stubGlobal(
      'Audio',
      class {
        volume = 1;
        currentTime = 0;
        preload = '';
        pause() {}
        load() {}
        play = play;
      },
    );
    localStorage.setItem(
      'readest-personal-page-sounds-v1',
      JSON.stringify({ enabled: true, selected: 'paper', volume: 75 }),
    );
    view = Object.assign(new EventTarget(), { renderer: new EventTarget() });
    vi.spyOn(useReaderStore.getState(), 'getView').mockReturnValue(view as unknown as FoliateView);
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible);
    vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
    vi.spyOn(ttsSessionManager, 'getPlaybackState').mockReturnValue('paused');
    vi.spyOn(ttsSessionManager, 'getActiveSession').mockReturnValue({
      bookHash: 'a'.repeat(32),
    } as ReturnType<typeof ttsSessionManager.getActiveSession>);
    render(createElement(PersonalPageTurnSound, { bookKey, monitor: true }));
  });
  afterEach(() => {
    cleanup();
    localStorage.removeItem('readest-personal-page-sounds-v1');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('keeps all generic relocates silent, including page reasons', () => {
    for (const reason of ['page', 'snap', 'navigation', 'anchor', 'container-scroll']) {
      view.renderer.dispatchEvent(new CustomEvent('relocate', { detail: { reason } }));
      view.dispatchEvent(
        new CustomEvent('relocate', { detail: { location: { current: 3, total: 30 } } }),
      );
    }
    expect(play).not.toHaveBeenCalled();
  });
  it('plays once per committed action, including rapid consecutive turns', () => {
    commit();
    commit();
    expect(play).toHaveBeenCalledTimes(2);
  });
  it('silences hidden, unfocused and active narration commits', () => {
    visible = 'hidden';
    commit();
    visible = 'visible';
    focused = false;
    commit();
    focused = true;
    vi.mocked(ttsSessionManager.getPlaybackState).mockReturnValue('playing');
    commit();
    expect(play).not.toHaveBeenCalled();
  });
  it('accepts Android false DOM focus only while the document is visible', () => {
    monitorPlatform.android = true;
    focused = false;
    commit();
    visible = 'hidden';
    commit();
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('removes the listener when the reader unmounts', () => {
    cleanup();
    commit();
    expect(play).not.toHaveBeenCalled();
  });
  it('a stationary touch cannot authorize a later paginator snap', async () => {
    Object.assign(view.renderer, { page: 0, primaryIndex: 0 });
    const point = { screenX: 100, screenY: 100 };
    dispatchTouchInterceptors(bookKey, {
      phase: 'start',
      touch: point,
      touchStart: point,
      deltaX: 0,
      deltaY: 0,
      deltaT: 0,
    });
    Object.assign(view.renderer, { page: 1 });
    view.renderer.dispatchEvent(new CustomEvent('relocate', { detail: { reason: 'snap' } }));
    dispatchTouchInterceptors(bookKey, {
      phase: 'end',
      touch: point,
      touchStart: point,
      deltaX: 0,
      deltaY: 0,
      deltaT: 100,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(play).not.toHaveBeenCalled();
  });
});
