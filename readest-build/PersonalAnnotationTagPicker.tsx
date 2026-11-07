'use client';
import { usePersonalT } from '@/utils/personalI18n';
import React, { useMemo, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { nextBooknoteStamp } from '@/utils/booknoteStamp';

/** Tags live on each annotation in its existing booknotes array, and are saved
 * through the exact same book config / notes sync pipeline as annotations. */
export const normalizeAnnotationTags = (input: unknown, maxTags = 24): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().replace(/\s+/g, ' ');
    if (!tag || tag.length > 40 || /[\u0000-\u001f]/.test(tag)) continue;
    const key = tag.toLocaleLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(tag); }
    if (result.length >= maxTags) break;
  }
  return result;
};

interface Props { bookKey: string; annotationIds: string[]; onClose: () => void; onSaved?: () => void }
export const PersonalAnnotationTagPicker: React.FC<Props> = ({bookKey, annotationIds, onClose, onSaved}) => {
  const t = usePersonalT();
  const { envConfig } = useEnv();
  const settings = useSettingsStore((s) => s.settings);
  const notes = useBookDataStore((s) => s.getConfig(bookKey)?.booknotes ?? []);
  const targets = notes.filter((n) => annotationIds.includes(n.id) && n.type === 'annotation' && !n.deletedAt);
  const existing = useMemo(() =>
    normalizeAnnotationTags(notes.filter((n) => n.type === 'annotation' && !n.deletedAt)
      .flatMap((n) => n.tags ?? []), 1000).sort((a, b) => a.localeCompare(b)),
  [notes]);
  const [selected, setSelected] = useState<string[]>(() =>
    normalizeAnnotationTags(targets.flatMap((n) => n.tags ?? [])));
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState<string[]>([]);

  const toggle = (tag: string) => setSelected((old) =>
    old.some((v) => v.toLocaleLowerCase() === tag.toLocaleLowerCase())
      ? old.filter((v) => v.toLocaleLowerCase() !== tag.toLocaleLowerCase())
      : [...old, tag]);
  const add = () => {
    const tag = normalizeAnnotationTags([newTag])[0];
    if (!tag) { setError(t('Enter a tag of 1–40 characters.')); return; }
    const match = [...existing, ...extra].find((v) => v.toLocaleLowerCase() === tag.toLocaleLowerCase());
    const name = match ?? tag;
    if (!match) setExtra((old) => [...old, tag]);
    setSelected((old) => normalizeAnnotationTags([...old, name]));
    setNewTag(''); setError('');
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const store = useBookDataStore.getState();
      const cfg = store.getConfig(bookKey);
      if (!cfg) throw new Error(t('Book configuration unavailable'));
      const tagList = normalizeAnnotationTags(selected);
      const ids = new Set(annotationIds);
      let updated = 0;
      const changed = (cfg.booknotes ?? []).map((note) => {
        if (!ids.has(note.id) || note.deletedAt || note.type !== 'annotation') return note;
        updated++;
        return { ...note, tags: [...tagList], updatedAt: nextBooknoteStamp(note) };
      });
      if (!updated) throw new Error(t('Annotation was removed or is unavailable'));
      const updatedConfig = store.updateBooknotes(bookKey, changed);
      if (!updatedConfig) throw new Error(t('Could not update annotations'));
      await store.saveConfig(envConfig, bookKey, updatedConfig, settings);
      // Update the SVG highlight overlayer immediately so adding/removing
      // tags creates/removes the tiny # badge without reloading the chapter.
      const views = useReaderStore.getState().getViewsById(bookKey.split('-')[0]!);
      for (const note of changed) {
        if (!ids.has(note.id) || note.deletedAt || note.type !== 'annotation') continue;
        await Promise.all(views.map((view) => view?.addAnnotation(note)));
      }
      (onSaved ?? onClose)();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Unable to save annotation tags'));
    } finally { setBusy(false); }
  };

  return (
    <div className='fixed inset-0 z-[150] flex items-end justify-center bg-black/60 sm:items-center'
      role='presentation' onPointerDown={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <section role='dialog' aria-modal='true' aria-label={t("Annotation tags")}
        className='bg-base-100 text-base-content flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl p-5 shadow-2xl sm:rounded-2xl'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>{t("Annotation tags")}</h2>
          <button type='button' onClick={onClose} aria-label={t("Close tag editor")} className='btn btn-ghost btn-sm'>✕</button>
        </div>
        <p className='mb-3 text-sm opacity-70'>{t("Select multiple existing tags or create one for this book.")}</p>
        <div className='mb-4 flex max-h-56 flex-wrap gap-2 overflow-y-auto'>
          {[...existing, ...extra].map((tag) => {
            const checked = selected.some((v) => v.toLocaleLowerCase() === tag.toLocaleLowerCase());
            return <button type='button' key={tag} aria-pressed={checked}
              className={checked ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => toggle(tag)}>{checked ? '✓ ' : '+ '}{tag}</button>;
          })}
          {!existing.length && !extra.length && <p className='text-sm opacity-60'>{t("No tags yet")}</p>}
        </div>
        <div className='flex gap-2'>
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            maxLength={40} placeholder={t("New tag")} aria-label={t("New annotation tag")}
            className='input input-bordered min-w-0 flex-1'/>
          <button type='button' className='btn btn-outline' onClick={add}>{t("+ Create")}</button>
        </div>
        {error && <p role='alert' className='mt-2 text-sm text-error'>{error}</p>}
        <div className='mt-5 flex gap-2'>
          <button type='button' className='btn btn-outline flex-1' onClick={onClose}>{t("Cancel")}</button>
          <button type='button' className='btn btn-primary flex-1' onClick={() => void save()} disabled={busy || !targets.length}>
            {busy ? t('Saving…') : t('Save tags')}
          </button>
        </div>
      </section>
    </div>
  );
};
