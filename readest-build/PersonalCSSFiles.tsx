'use client';
import { usePersonalT } from '@/utils/personalI18n';
import React, { useEffect, useRef, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { saveViewSettings } from '@/helpers/settings';
import { getStyles } from '@/utils/style';
import { validateCSS } from '@/utils/css';

type Sheet = { id: string; name: string; css: string };
type Profiles = { items: Sheet[]; selected: string; enabled: boolean };
const keyFor = (type: 'book'|'reader') => 'readest-personal-css-profiles-' + type;
const readProfiles = (type: 'book'|'reader'): Profiles => {
  try {
    const data = JSON.parse(localStorage.getItem(keyFor(type)) ?? '{}') as Partial<Profiles>;
    return {
      items: Array.isArray(data.items) ? data.items.filter((i) =>
        typeof i?.id === 'string' && typeof i?.name === 'string' && typeof i?.css === 'string').slice(0, 40) : [],
      selected: typeof data.selected === 'string' ? data.selected : '',
      enabled: data.enabled === true,
    };
  } catch { return {items:[], selected:'', enabled:false}; }
};
export const PersonalCSSFiles: React.FC<{bookKey:string; type:'book'|'reader'}> = ({bookKey,type}) => {
  const t = usePersonalT();
  const {envConfig} = useEnv();
  const {settings} = useSettingsStore();
  const {getView, getViewSettings, setViewSettings} = useReaderStore();
  const [profiles,setProfiles] = useState<Profiles>(() => readProfiles(type));
  const [error,setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const field = type === 'book' ? 'userStylesheet' : 'userUIStylesheet';
  const persist = (next:Profiles) => { setProfiles(next); localStorage.setItem(keyFor(type), JSON.stringify(next)); };
  const apply = (next:Profiles) => {
    const css = next.enabled ? next.items.find((i)=>i.id===next.selected)?.css ?? '' : '';
    const view = getViewSettings(bookKey) || settings.globalViewSettings;
    const updated = { ...view, [field]: css };
    setViewSettings(bookKey, updated);
    getView(bookKey)?.renderer.setStyles?.(getStyles(updated));
    void saveViewSettings(envConfig, bookKey, field, css, false, false);
    persist(next);
  };
  useEffect(() => {
    const value = getViewSettings(bookKey)?.[field] || '';
    if (!value.trim() || profiles.items.length) return;
    // Migration: keep handwritten CSS as a selectable imported profile, without losing it.
    const next = {items:[{id:'legacy',name:'Existing CSS',css:value}], selected:'legacy',enabled:true};
    persist(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);
  const add = async (file:File) => {
    try {
      if (!/\.css$/i.test(file.name) || file.size > 256 * 1024) throw new Error(t('Select a .css file smaller than 256 KB'));
      const css = await file.text();
      const result = validateCSS(css);
      if (!result.isValid) throw new Error(result.error || t('Invalid CSS'));
      // Protect localStorage and avoid duplicated contents.
      const id = crypto.randomUUID();
      const next = {
        items:[...profiles.items,{id,name:file.name,css}].slice(-40),
        selected:id,enabled:true,
      };
      apply(next);setError('');
    } catch(e) {setError(e instanceof Error?e.message:t('Unable to import CSS'));}
  };
  return <section className='space-y-3 p-3'>
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <strong className='text-sm'>{t(type === 'book'?'Book content CSS':'Reader interface CSS')}</strong>
      <label className='flex items-center gap-2 text-xs'>
        <span>{t(profiles.enabled?'On':'Off')}</span>
        <input aria-label={t("Toggle selected stylesheet")} className='toggle toggle-primary'
          type='checkbox' checked={profiles.enabled} onChange={(e)=>apply({...profiles,enabled:e.target.checked})}/>
      </label>
    </div>
    <div className='flex gap-2'>
      <select aria-label={t("Select CSS file profile")} className='select select-bordered min-w-0 flex-1'
        value={profiles.selected}
        onChange={(e)=>apply({...profiles,selected:e.target.value,enabled:!!e.target.value})}>
        <option value=''>{t("No stylesheet")}</option>
        {profiles.items.map((i)=><option key={i.id} value={i.id}>{i.name === 'Existing CSS' ? t('Existing CSS') : i.name}</option>)}
      </select>
      <button type='button' className='btn btn-outline' onClick={()=>fileInput.current?.click()}>{t('+ CSS')}</button>
    </div>
    <input ref={fileInput} type='file' accept='.css,text/css' className='hidden'
      aria-label={t("Import CSS file")} onChange={(e)=>{
        const file=e.target.files?.[0];if(file)void add(file);e.target.value='';
      }}/>
    {!!profiles.selected && <button type='button' className='btn btn-ghost btn-sm text-error'
      onClick={()=>{
        const next={items:profiles.items.filter((i)=>i.id!==profiles.selected),selected:'',enabled:false};
        apply(next);
      }}>{t("Remove selected stylesheet")}</button>}
    {error && <p role='alert' className='text-error text-xs'>{error}</p>}
    <p className='text-xs opacity-65'>{t("Import .css files to switch styles instantly. Original files stay on your device; this app saves the imported CSS contents.")}</p>
  </section>;
};
