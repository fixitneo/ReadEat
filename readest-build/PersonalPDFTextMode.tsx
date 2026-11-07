'use client';
import { usePersonalT } from '@/utils/personalI18n';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReaderStore } from '@/store/readerStore';
import { normalizePDFPage, pdfItemsToParagraphs, stepPDFReflow, type PersonalPDFTextItem } from '@/utils/personalPDFReflow';
export { pdfItemsToParagraphs } from '@/utils/personalPDFReflow';
import { eventDispatcher } from '@/utils/event';
import { normalizePersonalConfig, currentFoldMode, resolveViewportTap } from '@/utils/personalControlsConfig';
import { useSettingsStore } from '@/store/settingsStore';
type PDFPage = {getTextContent: () => Promise<{items: PersonalPDFTextItem[]}>};
type PDFDoc = { numPages: number; getPage:(i:number)=>Promise<PDFPage>; destroy:()=>Promise<void> };
type PDFJS = { getDocument:(v:{data:Uint8Array;isEvalSupported:boolean})=>{promise:Promise<PDFDoc>} };
type Options = {fontSize:number;lineHeight:number;wide:number;paper:'sepia'|'white'|'dark';animation:'none'|'fade'|'slide'};
const defaultOptions:Options={fontSize:19,lineHeight:1.75,wide:85,paper:'sepia',animation:'fade'};
const optionKey='readest-personal-pdf-options-v1';
const getOptions=():Options=>{
  try {return {...defaultOptions,...JSON.parse(localStorage.getItem(optionKey)??'{}')};}
  catch{return defaultOptions;}
};
export const PersonalPDFTextMode:React.FC<{bookKey:string;bookDoc:unknown}> = ({bookKey,bookDoc})=>{
  const t = usePersonalT();
  const pdfFile=(bookDoc as {personalPDFSource?:File}|null)?.personalPDFSource;
  const [active,setActive]=useState(false);
  const [options,setOptions]=useState<Options>(getOptions);
  const [showOptions,setShowOptions]=useState(false);
  const [page,setPage]=useState(1);
  const [slice,setSlice]=useState(0);
  const [sliceCount,setSliceCount]=useState(1);
  const [viewportWidth,setViewportWidth]=useState(1);
  const pendingLastSlice=useRef(false);
  const activeRef=useRef(false);
  const pageRef=useRef(1);
  const touchStart=useRef<{x:number;y:number}|null>(null);
  const lastSwipe=useRef(0);
  const [total,setTotal]=useState(0);
  const [paragraphs,setParagraphs]=useState<string[]>([]);
  const [contentPage,setContentPage]=useState(0);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const pdf=useRef<PDFDoc|null>(null);
  const requestId=useRef(0);
  const viewport=useRef<HTMLDivElement>(null);
  const columns=useRef<HTMLElement>(null);
  const persist=(next:Options)=>{setOptions(next);localStorage.setItem(optionKey,JSON.stringify(next));};
  pageRef.current=page;
  const syncToOriginal=useCallback((target:number)=>{
    const view=useReaderStore.getState().getView(bookKey);
    if(!view)return;
    // Reflow is a view of the original PDF, not a second independent
    // progress history. Restore the native renderer to the source page
    // shown when text mode closes; the native relocate event persists it.
    void Promise.resolve(view.renderer.goTo({index:Math.max(0,target-1)}))
      .catch((e:unknown)=>console.warn('Could not restore PDF position',e));
  },[bookKey]);
  const closeTextMode=useCallback(()=>{
    activeRef.current=false;
    syncToOriginal(pageRef.current);
    setActive(false);
  },[syncToOriginal]);
  useEffect(()=>{
    const toggle=(e:CustomEvent)=>{
      const detail=e.detail as {bookKey?:string;openOptions?:boolean}|undefined;
      if(detail?.bookKey!==bookKey)return;
      if(detail?.openOptions){setShowOptions(true);return;}
      if(activeRef.current){closeTextMode();return;}
      const progressPage=useReaderStore.getState().getProgress(bookKey)?.page;
      const sourcePage=normalizePDFPage(progressPage,Number.MAX_SAFE_INTEGER);
      pendingLastSlice.current=false;
      setSlice(0);
      setPage(sourcePage);
      pageRef.current=sourcePage;
      activeRef.current=true;
      setActive(true);
    };
    eventDispatcher.on('personal-pdf-mode-toggle',toggle);
    return()=>eventDispatcher.off('personal-pdf-mode-toggle',toggle);
  },[bookKey,closeTextMode]);
  const load=useCallback(async ()=>{
    if(!pdfFile)return;
    setLoading(true);setError('');
    try{
      if(pdfFile.size>100*1024*1024)throw new Error(t('This PDF exceeds the 100 MB safe text extraction limit.'));
      if(!pdf.current){
        await import('foliate-js/pdf.js');
        const lib=(globalThis as unknown as {pdfjsLib?:PDFJS}).pdfjsLib;
        if(!lib)throw new Error(t('PDF text engine unavailable'));
        pdf.current=await lib.getDocument({data:new Uint8Array(await pdfFile.arrayBuffer()),isEvalSupported:false}).promise;
      }
      const pages=pdf.current.numPages;
      setTotal(pages);
      setPage(p=>normalizePDFPage(p,pages));
    }catch(e){setError(e instanceof Error?e.message:t('Cannot read PDF text'));}
    finally{setLoading(false);}
  },[pdfFile,t]);
  useEffect(()=>{if(active&&!pdf.current)void load();},[active,load]);
  useEffect(()=>{
    const id=++requestId.current;
    const run=async()=>{
      if(!active || !pdf.current || !total)return;
      setLoading(true);
      try{
        const sourcePage=normalizePDFPage(page,total);
        const pdfPage=await pdf.current.getPage(sourcePage);
        const content=await pdfPage.getTextContent();
        if(id!==requestId.current)return;
        const next=pdfItemsToParagraphs(content.items);
        setError(next.length?'':t('No selectable text on this page. Scanned PDF pages require OCR.'));
        setParagraphs(next);
        setContentPage(sourcePage);
        if(!pendingLastSlice.current)setSlice(0);
      }catch(e){
        if(id===requestId.current){
          setParagraphs([]);
          setContentPage(0);
          setError(e instanceof Error?e.message:t('Text extraction failed'));
        }
      }finally{
        if(id===requestId.current)setLoading(false);
      }
    };
    void run();
    return()=>{requestId.current++;};
  },[active,page,total,t]);
  // Measure the fixed-height multi-column text flow. One source PDF page can
  // produce N independent phone-screen pages, with no vertical scrolling.
  useLayoutEffect(()=>{
    if(!active || contentPage!==page || loading || !viewport.current || !columns.current)return;
    const root=viewport.current;
    const measure=()=>{
      const width=Math.max(1,root.clientWidth);
      setViewportWidth(width);
      const count=Math.max(1,Math.ceil((columns.current?.scrollWidth??width)/width-.005));
      setSliceCount(count);
      setSlice(prev=>{
        const next=pendingLastSlice.current?count-1:Math.min(prev,count-1);
        root.scrollLeft=next*width;
        pendingLastSlice.current=false;
        return next;
      });
    };
    const observer=new ResizeObserver(measure);
    observer.observe(root);
    measure();
    void document.fonts?.ready.then(measure);
    return()=>observer.disconnect();
  },[active,page,contentPage,loading,paragraphs,options.fontSize,options.lineHeight,options.wide,showOptions,viewportWidth]);
  const turn=(direction:-1|1)=>{
    if(loading || !total)return;
    const next=stepPDFReflow(direction,page,total,slice,sliceCount);
    if(next.page!==page){
      pendingLastSlice.current=next.atPreviousPageEnd;
      setContentPage(0);
      setPage(next.page);
      setSlice(0);
    }else{
      setSlice(next.slice);
      if(viewport.current)viewport.current.scrollLeft=next.slice*Math.max(1,viewport.current.clientWidth);
    }
  };
  useEffect(()=>()=>{requestId.current++;if(pdf.current)void pdf.current.destroy();pdf.current=null;},[pdfFile]);
  if(!pdfFile||!active)return null;
  const bg=options.paper==='dark'?'#232323':options.paper==='white'?'#fff':'#e9e5d0';
  const color=options.paper==='dark'?'#e9e9e9':'#302d25';
  return <div className='absolute inset-0 z-30 flex flex-col' style={{background:bg,color}} data-personal-pdf-text='true'>
    <div className='flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3' style={{borderColor:'currentColor'}}>
      <button type='button' className='btn btn-ghost btn-sm' onClick={closeTextMode} aria-label={t("Return to original PDF")}>← PDF</button>
      <span className='text-xs'>{t('Text mode')} · PDF {page}/{total||'…'} · {slice+1}/{sliceCount}</span>
      <button type='button' className='btn btn-ghost btn-sm' aria-label={t("PDF text options")} onClick={()=>setShowOptions(v=>!v)}>⚙</button>
    </div>
    {showOptions&&<div className='max-h-[40vh] space-y-2 overflow-y-auto border-b p-3 text-sm' style={{borderColor:'currentColor'}}>
      <label className='flex items-center gap-2'>{t('Font')} <input type='range' min={13} max={36} value={options.fontSize} onChange={e=>persist({...options,fontSize:Number(e.target.value)})}/>{options.fontSize}px</label>
      <label className='flex items-center gap-2'>{t('Line height')} <input type='range' min={1.2} max={2.5} step={0.05} value={options.lineHeight} onChange={e=>persist({...options,lineHeight:Number(e.target.value)})}/></label>
      <label className='flex items-center gap-2'>{t('Text width')} <input type='range' min={55} max={100} value={options.wide} onChange={e=>persist({...options,wide:Number(e.target.value)})}/>{options.wide}%</label>
      <select aria-label={t("PDF background")} className='select select-bordered w-full' value={options.paper} onChange={e=>persist({...options,paper:e.target.value as Options['paper']})}><option value='sepia'>{t("Sepia")}</option><option value='white'>{t("White")}</option><option value='dark'>{t("Dark")}</option></select>
      <select aria-label={t("PDF page transition")} className='select select-bordered w-full' value={options.animation} onChange={e=>persist({...options,animation:e.target.value as Options['animation']})}><option value='none'>{t("None")}</option><option value='fade'>{t("Fade")}</option><option value='slide'>{t("Slide")}</option></select>
    </div>}
    <div ref={viewport} className='min-h-0 flex-1 overflow-hidden'
      style={{touchAction:'pan-x',overscrollBehavior:'none'}}
      onTouchStart={(e)=>{
        if(e.touches.length===1)touchStart.current={x:e.touches[0]!.clientX,y:e.touches[0]!.clientY};
      }}
      onTouchEnd={(e)=>{
        const origin=touchStart.current;
        touchStart.current=null;
        if(!origin || e.changedTouches.length!==1 || window.getSelection()?.toString())return;
        const dx=e.changedTouches[0]!.clientX-origin.x;
        const dy=e.changedTouches[0]!.clientY-origin.y;
        if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.35){
          lastSwipe.current=Date.now();
          turn(dx<0?1:-1);
        }
      }}
      onClick={(e)=>{
        if(Date.now()-lastSwipe.current<450 || e.button!==0 || window.getSelection()?.toString())return;
        const target=e.target as HTMLElement | null;
        if(target?.closest?.('a,button,input,textarea,select,[role="button"]'))return;
        const mode=currentFoldMode();
        const tap=resolveViewportTap(
          normalizePersonalConfig(useSettingsStore.getState().settings.personalControls),
          {x:e.clientX,y:e.clientY},e.currentTarget.getBoundingClientRect(),mode,
        );
        if(!tap)return;
        e.stopPropagation();
        if(tap.action==='page-prev'||tap.action==='section-prev')turn(-1);
        else if(tap.action==='page-next'||tap.action==='section-next')turn(1);
        else void eventDispatcher.dispatch('personal-control-action', {...tap,bookKey,mode,source:'pdf-text'});
      }}>
      {error&&<p role='alert' className='mx-auto max-w-xl p-4 text-sm'>{error}</p>}
      {loading&&<div className='p-4 text-center opacity-70'>{t('Extracting text…')}</div>}
      <article ref={columns} key={page+'-'+options.animation}
        className='whitespace-normal'
        style={{
          width:'100%',height:'100%',columnWidth:viewportWidth+'px',
          columnGap:'0px',columnFill:'auto',boxSizing:'border-box',
          fontSize:options.fontSize,lineHeight:options.lineHeight,
          textAlign:'start',fontFamily:'serif',
          animation:options.animation==='fade'?'fade-in 160ms ease-out':undefined,
        }}>
        {paragraphs.map((p,i)=><p key={i} style={{
          width:options.wide+'%',margin:'0 auto .85em',
          whiteSpace:'normal',wordBreak:'normal',overflowWrap:'anywhere',
          textAlign:'start',orphans:2,widows:2,
        }}>{p}</p>)}
      </article>
    </div>
    <div className='flex h-14 shrink-0 items-center justify-around border-t' style={{borderColor:'currentColor'}}>
      <button type='button' disabled={loading||(page<=1 && slice===0)} className='btn btn-ghost' onClick={()=>turn(-1)}>‹ {t('Previous page')}</button>
      <button type='button' className='btn btn-ghost' onClick={()=>setShowOptions(v=>!v)}>{page}/{total||'…'} · {slice+1}/{sliceCount}</button>
      <button type='button' disabled={loading||(page>=total && slice>=sliceCount-1)} className='btn btn-ghost' onClick={()=>turn(1)}>{t('Next page')} ›</button>
    </div>
  </div>;
};
