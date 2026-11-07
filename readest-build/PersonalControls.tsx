'use client';
import { usePersonalT } from '@/utils/personalI18n';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useSettingsStore } from '@/store/settingsStore';
import { eventDispatcher } from '@/utils/event';
import { saveViewSettings } from '@/helpers/settings';
import { viewPagination } from '@/app/reader/hooks/usePagination';
import {
  ACTIONS,
  DEFAULT_PERSONAL_CONFIG,
  normalizePersonalConfig,
  getPersonalLayout, updatePersonalLayout, currentFoldMode,
  type FoldMode, type PersonalLayout,
  type PersonalAction,
  type PersonalControlsConfig,
} from '@/utils/personalControlsConfig';

const choices = ACTIONS.filter((item) => item.id !== 'default' && item.id !== 'none');
const zoneChoices = ACTIONS;
const labelFor = (id: PersonalAction) => ACTIONS.find((a) => a.id === id)?.label ?? id;

const PersonalControls: React.FC = () => {
  const t = usePersonalT();
  const { appService, envConfig } = useEnv();
  const rawConfig = useSettingsStore((state) => state.settings.personalControls);
  const config = normalizePersonalConfig(rawConfig);
  const loaded = useSettingsStore((state) => !!state.settings.globalViewSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [zoneTestMode, setZoneTestMode] = useState(false);
  const [zoneTestHit, setZoneTestHit] = useState<{ zone: number; action: PersonalAction; mode: FoldMode } | null>(null);
  // Settings writes are serialized. Two rapid boundary slider movements must
  // never let the older asynchronous disk save replace the newer layout.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const [detectedMode, setDetectedMode] = useState<FoldMode>(() => currentFoldMode());
  const [editingMode, setEditingMode] = useState<FoldMode>(() => currentFoldMode());
  useEffect(() => {
    const check = () => setDetectedMode(currentFoldMode());
    window.addEventListener('resize', check);
    window.screen.orientation?.addEventListener('change', check);
    window.visualViewport?.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      window.screen.orientation?.removeEventListener('change', check);
      window.visualViewport?.removeEventListener('resize', check);
    };
  }, []);
  useEffect(() => { if (editorOpen) setEditingMode(detectedMode); }, [editorOpen, detectedMode]);
  const layout = getPersonalLayout(config, editingMode);
  const bookKeys = useReaderStore((state) => state.bookKeys);
  const activeBookKey = useSidebarStore((state) => state.sideBarBookKey) || bookKeys[0] || '';

  const update = (value: PersonalControlsConfig) => {
    const store = useSettingsStore.getState();
    const next = {
      ...store.settings,
      personalControls: normalizePersonalConfig(value),
    };
    store.setSettings(next);
    saveChain.current = saveChain.current.catch(() => undefined)
      .then(() => store.saveSettings(envConfig, next))
      .catch((error) => {
        console.error('Unable to save Personal Controls:', error);
        void eventDispatcher.dispatch('toast', {
          message: t('Could not save personal reader controls'),
          type: 'error',
          timeout: 3500,
        });
      });
  };
  const updateLayout = (change: Partial<PersonalLayout>) => {
    // Use the synchronous Zustand value, not a React render snapshot: fast
    // sliders can dispatch multiple changes before a component rerender.
    const latest = normalizePersonalConfig(useSettingsStore.getState().settings.personalControls);
    update(updatePersonalLayout(latest, editingMode, change));
  };
  const exportPreset = () => {
    const content = JSON.stringify({
      kind: 'readest-personal-controls',
      schemaVersion: 2,
      controls: config,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'readest-personal-controls.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const importPreset = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('Preset exceeds 100 KB');
      const incoming = JSON.parse(await file.text()) as {
        kind?: string; schemaVersion?: number; controls?: unknown;
      };
      if (incoming?.kind !== 'readest-personal-controls' || ![1, 2].includes(incoming.schemaVersion ?? 0) ||
          !incoming.controls || typeof incoming.controls !== 'object') {
        throw new Error('Not a Readest Personal settings export');
      }
      update(normalizePersonalConfig(incoming.controls));
      void eventDispatcher.dispatch('toast', { message: t('Reader control layout imported'), type: 'info', timeout: 2500 });
    } catch (error) {
      console.error('Personal controls import error:', error);
      void eventDispatcher.dispatch('toast', { message: t('Invalid reader control preset'), type: 'error', timeout: 3500 });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const execute = useCallback((action: PersonalAction, bookKey: string) => {
    if (!bookKey || action === 'default' || action === 'none') return;
    if (action === 'customize') { setEditorOpen(true); return; }
    const reader = useReaderStore.getState();
    const view = reader.getView(bookKey);
    const vs = reader.getViewSettings(bookKey);
    if (action === 'page-prev' || action === 'page-next' ||
        action === 'section-prev' || action === 'section-next') {
      if (!view || !vs) return;
      const side = action.endsWith('prev') ? 'up' : 'down';
      const mode = action.startsWith('section') ? 'section' : 'page';
      void viewPagination(view, vs, side, mode);
      return;
    }

    if (action === 'toggle-bars') {
      reader.setHoveredBookKey(reader.hoveredBookKey === bookKey ? null : bookKey);
      return;
    }
    if (action === 'single-page' || action === 'two-page') {
      if (!vs || !view) return;
      const maxColumnCount = action === 'single-page' ? 1 : 2;
      view.renderer.setAttribute('max-column-count', maxColumnCount);
      void saveViewSettings(envConfig, bookKey, 'maxColumnCount', maxColumnCount, false, false);
      return;
    }
    if (action === 'color' || action === 'progress' || action === 'font') {
      reader.setBottomBarTab(action);
      reader.setHoveredBookKey(bookKey);
      return;
    }
    if (action === 'tts') {
      void eventDispatcher.dispatch(reader.getViewState(bookKey)?.ttsEnabled ? 'tts-stop' : 'tts-speak', { bookKey });
      return;
    }
    if (action === 'bookmarks' || action === 'annotations') {
      const { getConfig, setConfig } = useBookDataStore.getState();
      const current = getConfig(bookKey);
      if (current) setConfig(bookKey, { viewSettings: { ...current.viewSettings, sideBarTab: action } });
      const sidebar = useSidebarStore.getState();
      sidebar.setSideBarBookKey(bookKey);
      sidebar.setSearchBarVisible(false);
      sidebar.setSideBarVisible(true);
      reader.setHoveredBookKey(null);
      return;
    }
    if (action === 'bookmark') {
      void eventDispatcher.dispatch('toggle-bookmark', { bookKey });
      return;
    }
    if (action === 'toc' || action === 'search') {
      const { getConfig, setConfig } = useBookDataStore.getState();
      const current = getConfig(bookKey);
      if (current) {
        setConfig(bookKey, { viewSettings: { ...current.viewSettings, sideBarTab: 'toc' } });
      }
      const sidebar = useSidebarStore.getState();
      sidebar.setSideBarBookKey(bookKey);
      sidebar.setSearchBarVisible(action === 'search');
      sidebar.setSideBarVisible(true);
      reader.setHoveredBookKey(null);
      return;
    }
    if (action === 'notes') {
      useSidebarStore.getState().setSideBarBookKey(bookKey);
      const notebook = useNotebookStore.getState();
      notebook.setNotebookActiveTab('notes');
      notebook.setNotebookVisible(!notebook.isNotebookVisible);
      reader.setHoveredBookKey(null);
      return;
    }
    if (action === 'translation' && vs) {
      const enabled = !vs.translationEnabled;
      void saveViewSettings(envConfig, bookKey, 'translationEnabled', enabled, true, false);
      reader.setViewSettings(bookKey, { ...vs, translationEnabled: enabled });
      return;
    }
    if (action === 'settings') {
      useSettingsStore.getState().setSettingsDialogBookKey(bookKey);
      useSettingsStore.getState().setSettingsDialogOpen(true);
      reader.setHoveredBookKey(null);
    }
  }, [envConfig]);

  useEffect(() => {
    const handleExternal = (event: CustomEvent) => {
      const detail = event.detail as {
        action?: PersonalAction; bookKey?: string; source?: string;
        zone?: number; mode?: FoldMode;
      } | undefined;
      if (!detail?.bookKey || !detail.action) return;
      if (zoneTestMode && detail.source && detail.zone && detail.mode) {
        setZoneTestHit({ zone: detail.zone, action: detail.action, mode: detail.mode });
        return; // Testing must not turn pages or modify bookmarks.
      }
      execute(detail.action, detail.bookKey);
    };
    const openEditor = () => setEditorOpen(true);
    eventDispatcher.on('personal-control-action', handleExternal);
    eventDispatcher.on('personal-controls-edit', openEditor);
    return () => {
      eventDispatcher.off('personal-control-action', handleExternal);
      eventDispatcher.off('personal-controls-edit', openEditor);
    };
  }, [execute, zoneTestMode]);

  if (!appService?.isAndroidApp || !loaded || !activeBookKey) return null;

  const actionSelect = (value: PersonalAction, onChange: (a: PersonalAction) => void, allowDefault = false) => (
    <select
      className='select select-bordered min-h-10 w-full min-w-0 bg-base-100 text-sm'
      value={value}
      aria-label={t("Assign reader action")}
      onChange={(event) => onChange(event.target.value as PersonalAction)}
    >
      {(allowDefault ? zoneChoices : choices).map((a) => <option key={a.id} value={a.id}>{t(a.label)}</option>)}
    </select>
  );

  return (
    <>
      {zoneTestMode && (
        <div className='pointer-events-none fixed left-1/2 top-16 z-[160] w-[min(95vw,360px)] -translate-x-1/2 rounded-xl border border-base-content/20 bg-base-100/95 p-3 text-center text-sm shadow-xl'>
          <strong>{t("3×3 touch test")}</strong>
          <p className='mt-1 text-xs'>{zoneTestHit
            ? t('Zone {zone} → {action} ({mode})', { zone: zoneTestHit.zone, action: t(labelFor(zoneTestHit.action)), mode: t(zoneTestHit.mode) })
            : 'Tap a numbered region of the reading page.'}</p>
          <button type='button' className='pointer-events-auto btn btn-primary btn-sm mt-2'
            onClick={() => { setZoneTestMode(false); setZoneTestHit(null); }}>{t("Finish test")}</button>
        </div>
      )}
      {editorOpen && (
        <div className='fixed inset-0 z-[130] flex items-end justify-center bg-black/50' onClick={() => setEditorOpen(false)}>
          <section
            role='dialog'
            aria-modal='true'
            aria-label={t("Readest Personal Controls")}
            data-personal-settings
            className='bg-base-100 text-base-content flex max-h-[89dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-3xl shadow-2xl'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex items-center justify-between border-b border-base-content/10 px-5 py-4'>
              <div>
                <h2 className='text-lg font-bold'>{t("Personal Controls")}</h2>
                <p className='text-xs opacity-65'>{t("Native footer, tap zones and reading shortcuts")}</p>
              </div>
              <button type='button' aria-label={t("Close personal controls")} onClick={() => setEditorOpen(false)} className='btn btn-circle btn-ghost'>✕</button>
            </div>
            <div className='space-y-6 overflow-y-auto px-4 pb-10 pt-4'>
              <section className='space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='font-semibold'>{t("Existing bottom reader bar")}</h3>
                  <span className='text-xs opacity-65'>{t('Detected:')} {detectedMode === 'folded' ? t('Folded cover') : t('Unfolded main')}</span>
                </div>
                <div role='group' aria-label={t("Edit fold profile")} className='join w-full'>
                  <button type='button' aria-pressed={editingMode === 'folded'} onClick={() => setEditingMode('folded')}
                    className={editingMode === 'folded' ? 'btn btn-primary join-item flex-1' : 'btn btn-outline join-item flex-1'}>{t("Folded")}</button>
                  <button type='button' aria-pressed={editingMode === 'unfolded'} onClick={() => setEditingMode('unfolded')}
                    className={editingMode === 'unfolded' ? 'btn btn-primary join-item flex-1' : 'btn btn-outline join-item flex-1'}>{t("Unfolded")}</button>
                </div>
                <p className='text-xs opacity-70'>{t("Each screen has independent toolbar actions, tap zones and top/bottom/left/right boundaries. Settings switch automatically when the screen folds.")}</p>
                <div className='space-y-2'>
                  {layout.toolbar.map((action, idx) => (
                    <div className='flex items-center gap-1' key={idx}>
                      <span className='w-5 shrink-0 text-center text-xs opacity-50'>{idx + 1}</span>
                      {actionSelect(action, (next) => updateLayout({ toolbar: layout.toolbar.map((item, i) => i === idx ? next : item) }))}
                      <button type='button' aria-label={t('Move action {number} up', { number: idx + 1 })} disabled={idx === 0} className='btn btn-ghost min-h-10 px-2' onClick={() => {
                        const toolbar = [...layout.toolbar];
                        [toolbar[idx - 1], toolbar[idx]] = [toolbar[idx]!, toolbar[idx - 1]!];
                        updateLayout({ toolbar });
                      }}>↑</button>
                      <button type='button' aria-label={t('Move action {number} down', { number: idx + 1 })} disabled={idx === layout.toolbar.length - 1} className='btn btn-ghost min-h-10 px-2' onClick={() => {
                        const toolbar = [...layout.toolbar];
                        [toolbar[idx], toolbar[idx + 1]] = [toolbar[idx + 1]!, toolbar[idx]!];
                        updateLayout({ toolbar });
                      }}>↓</button>
                      <button type='button' aria-label={t('Remove action {number}', { number: idx + 1 })} className='btn btn-ghost min-h-10 px-2 text-error' onClick={() => updateLayout({ toolbar: layout.toolbar.filter((_, i) => i !== idx) })}>×</button>
                    </div>
                  ))}
                </div>
                <button type='button' disabled={layout.toolbar.length >= 16} className='btn btn-outline btn-sm w-full' onClick={() => updateLayout({ toolbar: [...layout.toolbar, 'bookmark'] })}>{t("+ Add action")}</button>
              </section>
              <div className='border-t border-base-content/15'/>
              <section className='space-y-3'>
                <label className='flex items-center justify-between gap-3'>
                  <div><strong>{t("Custom tap layout")}</strong><p className='text-xs opacity-65'>{t("3 × 3 zones. Off protects text selection and links. The numbered diagram remains visible either way.")}</p></div>
                  <input type='checkbox' className='toggle toggle-primary' checked={layout.touchEnabled} onChange={(e) => updateLayout({ touchEnabled: e.target.checked })}/>
                </label>
                <div className='rounded-xl border border-base-content/15 bg-base-200/50 p-2'>
                  <div className='grid grid-cols-3 gap-1'>
                    {layout.touchZones.map((action, idx) => (
                      <label key={idx} className='rounded-lg border border-base-content/10 bg-base-100 p-1'>
                        <span className='mb-1 block text-center text-[10px] opacity-50'>{t('Zone {number}', {number: idx + 1})}</span>
                        <select aria-label={t('Touch zone {number}', { number: idx + 1 })} className='h-11 w-full min-w-0 rounded-md bg-base-200 px-1 text-[11px]' value={action} onChange={(e) => updateLayout({ touchZones: layout.touchZones.map((v, i) => i === idx ? e.target.value as PersonalAction : v) })}>
                          {zoneChoices.map((a) => <option key={a.id} value={a.id}>{t(a.label)}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
                <div className='grid grid-cols-[minmax(105px,2fr)_minmax(145px,3fr)] items-start gap-3 rounded-xl border border-base-content/10 p-3'>
                  <div className='sticky top-1 space-y-1'>
                    <span className='text-xs font-semibold'>{t("Numbered zones")}</span>
                    <div className='grid aspect-[5/9] max-h-[330px] overflow-hidden rounded-lg border border-primary/30 bg-base-200 p-0.5'
                      data-zone-preview
                      style={{
                        gridTemplateColumns: `${layout.xCuts[0]}fr ${layout.xCuts[1] - layout.xCuts[0]}fr ${100 - layout.xCuts[1]}fr`,
                        gridTemplateRows: `${layout.yCuts[0]}fr ${layout.yCuts[1] - layout.yCuts[0]}fr ${100 - layout.yCuts[1]}fr`,
                      }}>
                      {layout.touchZones.map((action, index) => (
                        <div key={index} title={t(labelFor(action))} className='flex min-h-0 items-center justify-center border border-primary/15 bg-primary/10 text-[11px] font-bold'>
                          {index + 1}
                        </div>
                      ))}
                    </div>
                    <span className='block text-[10px] opacity-60'>{layout.touchEnabled ? t('Enabled') : t('Preview only · Off')}</span>
                  </div>
                  <div className='min-w-0 space-y-3'>
                    <p className='text-xs font-semibold'>{t("Resizable boundaries")}</p>
                    {([
                      { label: 'Left boundary', axis: 'xCuts', idx: 0 },
                      { label: 'Right boundary', axis: 'xCuts', idx: 1 },
                      { label: 'Top boundary', axis: 'yCuts', idx: 0 },
                      { label: 'Bottom boundary', axis: 'yCuts', idx: 1 },
                    ] as const).map(({ label, axis, idx }) => {
                      const values = layout[axis];
                      const value = values[idx];
                      const min = idx === 0 ? 8 : values[0] + 8;
                      const max = idx === 0 ? values[1] - 8 : 92;
                      return <label key={label} className='block text-xs'>
                        <span>{t(label)}: {value}%</span>
                        <input aria-label={t(label)} className='range range-primary mt-1 w-full'
                          type='range' min={min} max={max} value={value}
                          onChange={(e) => updateLayout({ [axis]: idx === 0
                            ? [Number(e.target.value), values[1]]
                            : [values[0], Number(e.target.value)] })} />
                      </label>;
                    })}
                  </div>
                </div>
                <p className='text-xs opacity-65'>{t("Top/bottom boundaries adjust zone HEIGHTS (see live diagram). Default keeps Readest tapping behavior. None disables a tap in that zone. Text selection, links and swipes keep their native handlers.")}</p>
                <button type='button' className='btn btn-outline btn-sm w-full'
                  disabled={!layout.touchEnabled}
                  onClick={() => { setZoneTestHit(null); setZoneTestMode(true); setEditorOpen(false); }}>
                  {t("Test touch areas (no actions executed)")}
                </button>
              </section>
              <div className='space-y-2'>
                <p className='text-xs opacity-65'>{t("Saved to Readest settings.json. Included in full backups and, once a self-hosted Readest sync account is connected, app-settings sync.")}</p>
                <input ref={fileInputRef} type='file' accept='.json,application/json' className='hidden'
                  aria-label={t("Import reader control preset")} onChange={(e) => void importPreset(e.target.files?.[0])}/>
                <div className='flex gap-2'>
                  <button type='button' className='btn btn-outline flex-1' onClick={exportPreset}>{t("Export layout JSON")}</button>
                  <button type='button' className='btn btn-outline flex-1' onClick={() => fileInputRef.current?.click()}>{t("Import layout JSON")}</button>
                </div>
              </div>
              <div className='flex gap-2'>
                <button type='button' className='btn btn-outline flex-1' onClick={() => updateLayout(getPersonalLayout(DEFAULT_PERSONAL_CONFIG, editingMode))}>{t("Reset this profile")}</button>
                <button type='button' className='btn btn-primary flex-1' onClick={() => setEditorOpen(false)}>{t("Done")}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
export default PersonalControls;
