import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginManualTurn,
  commitManualTurn,
  runManualTurn,
  registerManualTurnSilencer,
  PERSONAL_PAGE_COMMIT,
} from '@/utils/personalManualTurn';
import { ttsSessionManager } from '@/services/tts/TTSSessionManager';
import type { FoliateView } from '@/types/view';
let stopSilencer: () => void;
afterEach(() => stopSilencer());
beforeEach(() => {
  stopSilencer = registerManualTurnSilencer(
    () => ttsSessionManager.getPlaybackState() === 'playing',
  );
  vi.restoreAllMocks();
  vi.spyOn(ttsSessionManager, 'getPlaybackState').mockReturnValue('paused');
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
describe('committed user turn audio provenance', () => {
  const setup = () => {
    const view = Object.assign(new EventTarget(), {
      renderer: { page: 0, primaryIndex: 0 },
    }) as unknown as FoliateView;
    const play = vi.fn();
    view.addEventListener(PERSONAL_PAGE_COMMIT, play);
    return { view, play };
  };
  it('a real page action emits once; no-op and rejected navigation do not', async () => {
    const { view, play } = setup();
    await runManualTurn(view, async () => {
      view.renderer.page = 1;
    });
    expect(play).toHaveBeenCalledTimes(1);
    await runManualTurn(view, async () => {});
    expect(play).toHaveBeenCalledTimes(1);
    await expect(
      runManualTurn(view, async () => {
        throw Error('capture');
      }),
    ).rejects.toThrow();
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('cancelled gesture and raw layout relocates cannot produce sound', () => {
    const { view, play } = setup();
    beginManualTurn(view);
    view.renderer.page = 1;
    view.renderer.page = 0;
    view.dispatchEvent(new CustomEvent('relocate', { detail: { reason: 'page' } }));
    expect(play).not.toHaveBeenCalled();
  });
  it('silences a TTS turn even when playback pauses before commit', () => {
    const { view, play } = setup();
    vi.mocked(ttsSessionManager.getPlaybackState).mockReturnValue('playing');
    const ticket = beginManualTurn(view);
    view.renderer.page = 1;
    vi.mocked(ttsSessionManager.getPlaybackState).mockReturnValue('paused');
    expect(commitManualTurn(view, ticket)).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });
  it('silences a turn interrupted by app blur even if it resumes before commit', () => {
    const { view, play } = setup();
    const ticket = beginManualTurn(view);
    view.renderer.page = 1;
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    expect(commitManualTurn(view, ticket)).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });
  it('accepts rapid separate turns without a time throttle dropping the second', async () => {
    const { view, play } = setup();
    await runManualTurn(view, async () => {
      view.renderer.page = 1;
    });
    await runManualTurn(view, async () => {
      view.renderer.page = 2;
    });
    expect(play).toHaveBeenCalledTimes(2);
  });
});

it('a manual ticket cannot be committed twice', () => {
  const view = Object.assign(new EventTarget(), {
    renderer: { page: 0, primaryIndex: 0 },
  }) as unknown as FoliateView;
  const play = vi.fn();
  view.addEventListener(PERSONAL_PAGE_COMMIT, play);
  const ticket = beginManualTurn(view);
  view.renderer.page = 1;
  commitManualTurn(view, ticket);
  commitManualTurn(view, ticket);
  expect(play).toHaveBeenCalledTimes(1);
});
