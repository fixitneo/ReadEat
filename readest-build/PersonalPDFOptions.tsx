'use client';
import { usePersonalT } from '@/utils/personalI18n';
import React from 'react';
import {useBookDataStore} from '@/store/bookDataStore';
import {useReaderStore} from '@/store/readerStore';
import {useSettingsStore} from '@/store/settingsStore';
import {useEnv} from '@/context/EnvContext';
import {saveViewSettings} from '@/helpers/settings';
import {applyPageTurnAttributes} from '@/app/reader/hooks/useCapturedTurn';
import type {ViewSettings} from '@/types/book';
import {eventDispatcher} from '@/utils/event';

export const PersonalPDFOptions:React.FC<{bookKey:string}> = ({bookKey})=>{
  const t = usePersonalT();
 const {envConfig}=useEnv();
 const book=useBookDataStore(s=>s.getBookData(bookKey)?.book);
 const viewSettings=useReaderStore(s=>s.getViewSettings(bookKey));
 const defaults=useSettingsStore(s=>s.settings.globalViewSettings);
 if(book?.format!=='PDF')return null;
 const settings=viewSettings??defaults;
 if(!settings)return null;
 const change=<K extends keyof ViewSettings>(key:K,value:ViewSettings[K])=>{
   const reader=useReaderStore.getState();
   const current=reader.getViewSettings(bookKey)??settings;
   const next={...current,[key]:value};
   const view=reader.getView(bookKey);
   if(key==='zoomMode') view?.renderer.setAttribute('zoom',String(value));
   if(key==='spreadMode') view?.renderer.setAttribute('spread',String(value));
   if(key==='scrolled')view?.renderer.setAttribute('flow',value?'scrolled':'paginated');
   if(key==='scrolledDirection')view?.renderer.setAttribute('scroll-direction',String(value));
   if(key==='zoomLevel')view?.renderer.setAttribute('scale-factor',Number(value));
   if(key==='pageTurnStyle'||key==='animated'||key==='scrolled') {
     if(view)applyPageTurnAttributes(view,next,true);
   }
   reader.setViewSettings(bookKey,next);
   void saveViewSettings(envConfig,bookKey,key,value,true,true);
 };
 return <section className='space-y-3 rounded-xl border border-base-content/15 p-3'>
  <div className='flex items-center justify-between gap-2'><strong>{t("PDF options")}</strong>
    <button type='button' className='btn btn-outline btn-sm' onClick={()=>
      void eventDispatcher.dispatch('personal-pdf-mode-toggle',{bookKey})}>{t("Toggle PDF / text mode")}</button>
  </div>
  <label className='block text-sm'>{t("Page fit")}
    <select aria-label={t("PDF page fit")} className='select select-bordered mt-1 w-full'
      value={settings.zoomMode} onChange={e=>change('zoomMode',e.target.value as ViewSettings['zoomMode'])}>
      <option value='fit-page'>{t("Fit entire page")}</option><option value='fit-width'>{t("Fit width")}</option>
      <option value='original-size'>{t("Original size")}</option><option value='custom'>{t("Custom zoom")}</option>
    </select>
  </label>
  <label className='block text-sm'>{t("Page layout")}
    <select aria-label={t("PDF spread layout")} className='select select-bordered mt-1 w-full'
      value={settings.spreadMode} onChange={e=>change('spreadMode',e.target.value as ViewSettings['spreadMode'])}>
      <option value='auto'>{t("Automatic spread")}</option><option value='none'>{t("Single page")}</option>
    </select>
  </label>
  <label className='flex items-center justify-between gap-2 text-sm'>{t("Continuous scrolling")}
    <input type='checkbox' className='toggle' checked={settings.scrolled} onChange={e=>change('scrolled',e.target.checked)}/>
  </label>
  <label className='block text-sm'>{t("Reading direction")}
    <select aria-label={t("PDF reading direction")} className='select select-bordered mt-1 w-full'
      value={settings.rtl?'rtl':'ltr'} onChange={e=>change('rtl',e.target.value==='rtl')}>
      <option value='ltr'>{t("Left to right")}</option><option value='rtl'>{t("Right to left")}</option>
    </select>
  </label>
  <label className='block text-sm'>{t("Scroll direction")}
    <select aria-label={t("PDF scrolling direction")} className='select select-bordered mt-1 w-full'
      value={settings.scrolledDirection} onChange={e=>change('scrolledDirection',e.target.value as ViewSettings['scrolledDirection'])}>
      <option value='vertical'>{t("Vertical")}</option><option value='horizontal'>{t("Horizontal")}</option>
    </select>
  </label>
  <label className='block text-sm'>{t("Page turn effect")}
    <select aria-label={t("PDF page turn effect")} className='select select-bordered mt-1 w-full'
      value={settings.pageTurnStyle} onChange={e=>change('pageTurnStyle',e.target.value as ViewSettings['pageTurnStyle'])}>
      <option value='push'>{t("Push")}</option><option value='slide'>{t("Slide")}</option><option value='curl'>{t("Page curl")}</option>
    </select>
  </label>
  <label className='flex items-center justify-between gap-2 text-sm'>{t("Page turn animation")}
    <input type='checkbox' className='toggle' checked={settings.animated} onChange={e=>change('animated',e.target.checked)}/>
  </label>
  <p className='text-xs opacity-65'>{t("PDF pages are rendered by the existing Readest PDF.js engine. Apple/Google-native effects and OpenGL backends from Moon+ Reader are not available.")}</p>
 </section>;
};
