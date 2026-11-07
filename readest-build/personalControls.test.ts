import { describe, expect, it } from 'vitest';
import type { SystemSettings } from '@/types/settings';
import { sanitizeSettingsForBackup, mergeRestoredSettings } from '@/services/backupService';
import { SETTINGS_WHITELIST } from '@/services/sync/adapters/settings';
import {
  DEFAULT_PERSONAL_CONFIG,
  normalizePersonalConfig,
  resolveTouchAction,
  getPersonalLayout, updatePersonalLayout, inferFoldMode, resolveViewportTap,
} from '@/utils/personalControlsConfig';

describe('Readest Personal control layouts', () => {
  it('loads a stable default when an existing installation has no personal layout', () => {
    const config = normalizePersonalConfig(null);
    expect(config.enabled).toBe(true);
    expect(config.touchEnabled).toBe(false);
    expect(config.xCuts).toEqual([28, 72]);
    expect(config.yCuts).toEqual([30, 70]);
    expect(resolveTouchAction(config, 0.2, 0.5)).toBe(null);
  });

  it('supports independently movable grid boundaries and maps all nine touch zones', () => {
    const values = ['page-prev', 'page-next', 'bookmark', 'toc', 'notes',
      'search', 'settings', 'translation', 'toggle-bars'] as const;
    const config = normalizePersonalConfig({
      ...DEFAULT_PERSONAL_CONFIG,
      foldProfiles: undefined,
      touchEnabled: true,
      xCuts: [17, 68],
      yCuts: [21, 82],
      touchZones: values,
    });
    const xs = [0.01, 0.45, 0.94], ys = [0.05, 0.4, 0.95];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(resolveTouchAction(config, xs[col]!, ys[row]!)).toBe(values[row * 3 + col]);
      }
    }
  });

  it('rejects malformed import data without throwing', () => {
    const cfg = normalizePersonalConfig({
      enabled: true,
      touchEnabled: true,
      xCuts: [NaN, -30],
      yCuts: [-10, 300],
      dock: 'malicious',
      toolbar: ['bookmark', '__proto__', 'page-next'],
      touchZones: [null, undefined, '__proto__'],
    });
    expect(cfg.dock).toBe('bottom');
    expect(cfg.toolbar).toEqual(['bookmark', 'page-next']);
    expect(cfg.xCuts[0]).toBeLessThanOrEqual(cfg.xCuts[1] - 8);
    expect(cfg.yCuts[0]).toBeLessThanOrEqual(cfg.yCuts[1] - 8);
    expect(cfg.touchZones[2]).toBe('default');
    expect(resolveTouchAction(cfg, Infinity, 0.1)).toBe(null);
  });

  it('preserves explicit no-action and default behavior', () => {
    const cfg = normalizePersonalConfig({
      ...DEFAULT_PERSONAL_CONFIG,
      foldProfiles: undefined,
      touchEnabled: true,
      touchZones: Array.from({ length: 9 }, (_, i) => i === 4 ? 'none' : 'default'),
    });
    expect(resolveTouchAction(cfg, 0.5, 0.5)).toBe('none');
    expect(resolveTouchAction(cfg, 0.1, 0.1)).toBe(null);
  });

  it('round-trips a portable settings JSON payload through validation', () => {
    const configured = normalizePersonalConfig({
      ...DEFAULT_PERSONAL_CONFIG,
      foldProfiles: undefined,
      xCuts: [22, 76], yCuts: [16, 86],
      toolbar: ['bookmark', 'search'],
    });
    const encoded = JSON.stringify({
      kind: 'readest-personal-controls', schemaVersion: 1, controls: configured,
    });
    expect(normalizePersonalConfig(JSON.parse(encoded).controls)).toEqual(configured);
  });
  it('includes personal controls in global backup, restore and remote replica sync', () => {
    const original = normalizePersonalConfig({
      ...DEFAULT_PERSONAL_CONFIG, foldProfiles: undefined, touchEnabled: true,
      xCuts: [24, 74], yCuts: [18, 79],
    });
    const source = { personalControls: original } as SystemSettings;
    const portable = sanitizeSettingsForBackup(source);
    expect(portable.personalControls).toEqual(original);
    const restored = mergeRestoredSettings({ personalControls: DEFAULT_PERSONAL_CONFIG } as SystemSettings, portable);
    expect(restored.personalControls).toEqual(original);
    expect(SETTINGS_WHITELIST).toContain('personalControls');
  });

  it('migrates legacy single layouts to two separately editable fold profiles', () => {
    const legacy = normalizePersonalConfig({
      version: 1, toolbar: ['bookmark', 'search'],
      touchEnabled: true, xCuts: [12, 82], yCuts: [15, 87],
    });
    expect(getPersonalLayout(legacy, 'folded').yCuts).toEqual([15, 87]);
    expect(getPersonalLayout(legacy, 'unfolded').yCuts).toEqual([15, 87]);
    const unfolded = updatePersonalLayout(legacy, 'unfolded', {
      toolbar: ['toc'], yCuts: [25, 65], touchZones: Array(9).fill('page-next'),
    });
    expect(getPersonalLayout(unfolded, 'unfolded').yCuts).toEqual([25, 65]);
    expect(getPersonalLayout(unfolded, 'folded').yCuts).toEqual([15, 87]);
    expect(getPersonalLayout(unfolded, 'folded').toolbar).toEqual(['bookmark', 'search']);
    expect(getPersonalLayout(unfolded, 'unfolded').toolbar).toEqual(['toc']);
    expect(normalizePersonalConfig(JSON.parse(JSON.stringify(unfolded)))).toEqual(unfolded);
  });

  it('selects the correct profile in a folded or unfolded viewport', () => {
    const base = updatePersonalLayout(normalizePersonalConfig(null), 'folded', {
      touchEnabled: true, touchZones: Array(9).fill('page-prev'),
    });
    const cfg = updatePersonalLayout(base, 'unfolded', {
      touchEnabled: true, touchZones: Array(9).fill('page-next'),
    });
    expect(resolveTouchAction(cfg, 0.5, 0.5, 'folded')).toBe('page-prev');
    expect(resolveTouchAction(cfg, 0.5, 0.5, 'unfolded')).toBe('page-next');
    expect(inferFoldMode(370, 900, 370, 900)).toBe('folded');
    expect(inferFoldMode(800, 1200, 800, 1200)).toBe('unfolded');
    expect(inferFoldMode(800, 1200, 800, 360)).toBe('unfolded');
  });

  it('changes the top and bottom hit-test rows independently in either profile', () => {
    const actions = Array.from({length:9},(_,i)=>i < 3 ? 'bookmark' : i < 6 ? 'toc' : 'page-next');
    const cfg = updatePersonalLayout(normalizePersonalConfig(null), 'folded', {
      touchEnabled: true, yCuts: [15, 85], touchZones: actions as any,
    });
    expect(resolveTouchAction(cfg, 0.5, 0.10, 'folded')).toBe('bookmark');
    expect(resolveTouchAction(cfg, 0.5, 0.20, 'folded')).toBe('toc');
    expect(resolveTouchAction(cfg, 0.5, 0.80, 'folded')).toBe('toc');
    expect(resolveTouchAction(cfg, 0.5, 0.90, 'folded')).toBe('page-next');
    const moved = updatePersonalLayout(cfg, 'folded', { yCuts: [35, 60] });
    expect(resolveTouchAction(moved, 0.5, 0.20, 'folded')).toBe('bookmark');
    expect(resolveTouchAction(moved, 0.5, 0.70, 'folded')).toBe('page-next');
  });

  it('runs actual pixel hit testing for the nine configured zones in EPUB and PDF viewports', () => {
    const actions = [
      'bookmark','notes','search',
      'page-prev','toggle-bars','page-next',
      'toc','settings','translation',
    ] as const;
    const cfg = updatePersonalLayout(normalizePersonalConfig(null), 'folded', {
      touchEnabled: true, touchZones: [...actions],
      xCuts: [25, 75], yCuts: [20, 70],
    });
    const rect = {left: 18, top: 65, width: 400, height: 800};
    const xs = [0.1, 0.5, 0.9], ys = [0.1, 0.5, 0.9];
    for(let row=0;row<3;row++)for(let col=0;col<3;col++) {
      const tap = resolveViewportTap(cfg, {
        x: rect.left + rect.width * xs[col]!,
        y: rect.top + rect.height * ys[row]!,
      }, rect, 'folded');
      expect(tap?.zone).toBe(row*3+col+1);
      expect(tap?.action).toBe(actions[row*3+col]);
    }
    expect(resolveViewportTap(cfg,{x:17,y:200},rect,'folded')).toBe(null);
    expect(resolveViewportTap(cfg,{x:300,y:866},rect,'folded')).toBe(null);
    expect(resolveViewportTap(cfg,{x:75,y:160},{...rect,width:0},'folded')).toBe(null);
  });

  it('uses separately saved folded/unfolded zones when the physical screen changes', () => {
    const folded=updatePersonalLayout(normalizePersonalConfig(null),'folded',{
      touchEnabled:true,touchZones:Array(9).fill('page-prev'),
    });
    const both=updatePersonalLayout(folded,'unfolded',{
      touchEnabled:true,touchZones:Array(9).fill('page-next'),
    });
    const rect={left:100,top:50,width:600,height:900};
    const point={x:400,y:500};
    expect(resolveViewportTap(both,point,rect,'folded')?.action).toBe('page-prev');
    expect(resolveViewportTap(both,point,rect,'unfolded')?.action).toBe('page-next');
    expect(resolveViewportTap({...both,enabled:false},point,rect,'folded')).toBe(null);
  });

  it('preserves no-action as an explicitly consumed tap, unlike default behavior', () => {
    const cfg=updatePersonalLayout(normalizePersonalConfig(null),'folded',{
      touchEnabled:true,
      touchZones:Array.from({length:9},(_,i)=>i===4?'none':'default'),
    });
    const viewport={left:0,top:100,width:400,height:700};
    expect(resolveViewportTap(cfg,{x:200,y:450},viewport,'folded')?.action).toBe('none');
    expect(resolveViewportTap(cfg,{x:20,y:120},viewport,'folded')).toBe(null);
  });

});
