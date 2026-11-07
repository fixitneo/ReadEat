'use client';
import {useEffect,useRef,useState} from 'react';
import {useReaderStore} from '@/store/readerStore';
import {useSettingsStore} from '@/store/settingsStore';
import {useEnv} from '@/context/EnvContext';
import {validatePersonalProfileBudget} from '@/utils/personalProfileBudget';
import {ttsSessionManager,getBookHashFromKey} from '@/services/tts/TTSSessionManager';

export type PageSoundFile={id:string;name:string;data:string};
export type PageSoundConfig={enabled:boolean;selected:string;volume:number;files:PageSoundFile[]};
export const PAGE_SOUNDS_KEY='readest-personal-page-sounds-v1';
export const DEFAULT_PAGE_SOUNDS:PageSoundConfig={enabled:false,selected:'paper',volume:75,files:[]};
export const PAPER_SOUNDS=[
 {id:'paper',name:'종이 한 장 넘기기',url:'/personal-sounds/paper.mp3'},
 {id:'book',name:'두꺼운 책장 넘기기',url:'/personal-sounds/book.mp3'},
 {id:'soft',name:'부드러운 종이 넘김',url:'/personal-sounds/soft.mp3'},
] as const;

const clamp=(n:number)=>Math.max(0,Math.min(100,Number.isFinite(n)?n:75));
export function normalizePageSoundConfig(value:unknown):PageSoundConfig{
 if(!value||typeof value!=='object'||Array.isArray(value))return {...DEFAULT_PAGE_SOUNDS,files:[]};
 const o=value as Partial<PageSoundConfig>;
 const files=Array.isArray(o.files)?o.files.filter(
   f=>typeof f?.id==='string'&&/^[a-z0-9-]{3,80}$/i.test(f.id)&&
     typeof f?.name==='string'&&f.name.length<=80&&
     typeof f?.data==='string'&&/^data:audio\/(?:mpeg|mp3|wav|x-wav|wave|ogg|mp4|x-m4a);base64,[a-z0-9+/=]+$/i.test(f.data)&&
     f.data.length<=160000
 ).slice(-5):[];
 return {enabled:o.enabled===true,
   selected:typeof o.selected==='string'&&
     (PAPER_SOUNDS.some(s=>s.id===o.selected)||files.some(f=>f.id===o.selected))?o.selected:'paper',
   volume:clamp(typeof o.volume==='number'?o.volume:75),files};
}

export function getLegacyPageSounds():PageSoundConfig{
 try{
  const raw=typeof localStorage!=='undefined'?localStorage.getItem(PAGE_SOUNDS_KEY):null;
  if(!raw)return normalizePageSoundConfig(null);
  return normalizePageSoundConfig(JSON.parse(raw));
 }catch{return normalizePageSoundConfig(null);}
}

const soundSources=new Map<string,HTMLAudioElement>();
function assetSource(config:PageSoundConfig):string{
 const builtin=PAPER_SOUNDS.find(sound=>sound.id===config.selected);
 if(builtin)return builtin.url;
 return config.files.find(sound=>sound.id===config.selected)?.data||PAPER_SOUNDS[0].url;
}

export function playPageSound(config?:PageSoundConfig,force=false){
 const fromStore=useSettingsStore.getState().settings?.personalProfile?.pageSounds;
 const effective=normalizePageSoundConfig(config??fromStore??getLegacyPageSounds());
 if(!effective.enabled&&!force)return;
 const source=assetSource(effective);
 try{
  // Reuse the cached recording so user interaction primes the native player;
  // overlapping relocate events are throttled in the reader monitor.
  let audio=soundSources.get(source);
  if(!audio){audio=new Audio(source);audio.preload='auto';soundSources.set(source,audio);}
  audio.volume=clamp(effective.volume)/100;
  audio.pause();
  audio.currentTime=0;
  void audio.play().catch(error=>console.debug('Paper sound not available',error));
 }catch(error){console.debug('Paper sound not available',error);}
}


/** Only visible page changes caused by an actual paper-turn action get sound.
 * Foliate's generic 'relocate' is also raised for reflow, app restore and
 * automated TTS following; it is NOT equivalent to a manual page turn. */
export function pageSoundPosition(detail:unknown,renderer?:unknown):string|null{
 if(!detail||typeof detail!=='object')return null;
 const d=detail as {location?:{current?:number;total?:number};section?:{current?:number}};
 // Reading-progress units may span several viewport pages. Compare the
 // physical paginator page (EPUB) or fixed-layout index (PDF) when available.
 const physical=renderer&&typeof renderer==='object'
  ?renderer as {page?:number;primaryIndex?:number;index?:number}:null;
 const physicalSection=physical?.primaryIndex??d.section?.current;
 if(typeof physical?.page==='number'&&Number.isInteger(physical.page)&&physical.page>=0&&Number.isInteger(physicalSection))
  return String(physicalSection)+':'+String(physical.page);
 if(typeof physical?.index==='number'&&Number.isInteger(physical.index)&&physical.index>=0)
  return String(physical.index)+':0';
 const page=d.location;
 if(!Number.isInteger(page?.current)||!Number.isInteger(page?.total)||
    (page?.total??0)<=0||(page?.current??-1)<0)return null;
 const section=Number.isInteger(d.section?.current)?d.section!.current:'?';
 return String(section)+':'+String(page!.current);
}
export function shouldSoundPageTurn(
 before:string|null,after:string|null,reason:string|null,
 visible:boolean,focused:boolean,ttsPlaying:boolean
):boolean{
 return before!==null&&after!==null&&before!==after&&
  (reason==='page'||reason==='snap')&&visible&&focused&&!ttsPlaying;
}

export function PersonalPageTurnSound({bookKey,monitor=false}:{bookKey:string;monitor?:boolean}){
 const {envConfig,appService}=useEnv();
 const storeSettings=useSettingsStore(s=>s.settings);
 const setSettings=useSettingsStore(s=>s.setSettings);
 const saveSettings=useSettingsStore(s=>s.saveSettings);
 const synced=storeSettings?.personalProfile?.pageSounds;
 const config=normalizePageSoundConfig(synced??getLegacyPageSounds());
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const [draftVolume,setDraftVolume]=useState<number|null>(null);
 const pendingVolume=useRef<number|null>(null);
 const input=useRef<HTMLInputElement>(null);
 const view=useReaderStore(s=>s.getView(bookKey));

 // Legacy localStorage v1 remains readable after the upgrade. On the first
 // deliberate settings edit, the same choice is stored in SystemSettings
 // and thus enters both the settings replica and selective ZIP backup.
 const update=async(next:PageSoundConfig)=>{
  if(!storeSettings)return;
  setSaving(true);setError('');
  try{
   const checked=normalizePageSoundConfig(next);
   const current=useSettingsStore.getState().settings;
   if(!current)return;
   const changed={...current,
    personalProfile:{...current.personalProfile,pageSounds:checked}};
   validatePersonalProfileBudget(changed.personalProfile);
   setSettings(changed);
   await saveSettings(envConfig,changed);
   localStorage.setItem(PAGE_SOUNDS_KEY,JSON.stringify(checked));
  }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
  finally{setSaving(false);}
 };
 useEffect(()=>{
  if(!view||!monitor)return;
  let previous=pageSoundPosition(view.lastLocation,view.renderer);
  let swipeStart:string|null=null;
  let rendererTurn:{reason:string|null;at:number}|null=null;
  let timer:ReturnType<typeof setTimeout>|null=null;
  let lastPlayedAt=0;
  // Android PDF WebViews can report false DOM focus while their app window is active.
  const hasReaderFocus=()=>appService?.isAndroidApp===true||document.hasFocus();
  const isNarrating=()=>ttsSessionManager.getPlaybackState()==='playing'&&
   ttsSessionManager.getActiveSession()?.bookHash===getBookHashFromKey(bookKey);
  const cancelPending=()=>{
   if(timer!==null)clearTimeout(timer);
   timer=null;rendererTurn=null;swipeStart=null;
   previous=pageSoundPosition(view.lastLocation,view.renderer)??previous;
  };
  const onRendererRelocate=(event:Event)=>{
   rendererTurn={reason:(event as CustomEvent<{reason?:string}>).detail?.reason??null,at:Date.now()};
  };
  const relocate=(event:Event)=>{
   const current=pageSoundPosition((event as CustomEvent).detail,view.renderer);
   if(current===null)return;
   if(timer!==null)clearTimeout(timer);
   const activeAtEvent=document.visibilityState==='visible'&&hasReaderFocus()&&!isNarrating();
   const relocatedAt=Date.now();
   // The view event can precede our renderer listener. Pair them after dispatch.
   timer=setTimeout(()=>{
    timer=null;
    const turn=rendererTurn;rendererTurn=null;
    const reason=turn&&Math.abs(turn.at-relocatedAt)<300?turn.reason:null;
    const from=previous;previous=current;
    const visible=document.visibilityState==='visible',focused=hasReaderFocus(),ttsPlaying=isNarrating();
    if(!activeAtEvent||!visible||!focused||ttsPlaying){swipeStart=null;return;}
    // A swipe can report the destination via container-scroll before snap.
    // Keep its starting page until the final snap so it sounds once.
    if(reason==='container-scroll'){
     if(swipeStart===null&&from!==current)swipeStart=from;
     return;
    }
    const before=reason==='snap'?(swipeStart??from):from;
    swipeStart=null;
    if(!shouldSoundPageTurn(before,current,reason,visible,focused,ttsPlaying))return;
    const now=Date.now();
    if(now-lastPlayedAt<170)return;
    lastPlayedAt=now;playPageSound();
   },0);
  };
  window.addEventListener('blur',cancelPending);
  document.addEventListener('visibilitychange',cancelPending);
  view.renderer.addEventListener('relocate',onRendererRelocate);
  view.addEventListener('relocate',relocate);
  return()=>{
   window.removeEventListener('blur',cancelPending);
   document.removeEventListener('visibilitychange',cancelPending);
   view.renderer.removeEventListener('relocate',onRendererRelocate);
   view.removeEventListener('relocate',relocate);
   cancelPending();
  };
 },[bookKey,view,monitor,appService?.isAndroidApp]);

 const commitVolume=()=>{
  const value=pendingVolume.current;
  if(value===null)return;
  pendingVolume.current=null;
  setDraftVolume(null);
  if(value!==config.volume)void update({...config,volume:value});
 };
 const addAudio=async(file:File)=>{
  setError('');
  if(!/^audio\//.test(file.type)&&!/\.(mp3|ogg|m4a|wav)$/i.test(file.name)){
   setError('오디오 파일을 선택하세요.');return;
  }
  // The settings replica holds the entire custom sample. Protect remote
  // settings row size and network traffic by allowing short compressed clips.
  if(file.size>12000){setError('서버 동기화 제한 때문에 12KB 이하로 압축된 짧은 오디오만 추가할 수 있습니다.');return;}
  try{
   const data=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error('오디오 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
   });
   const item={id:crypto.randomUUID(),name:file.name,data};
   await update({...config,files:[...config.files,item].slice(-3),selected:item.id,enabled:true});
  }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
 };
 if(monitor)return null;
 return <section className='space-y-3 rounded-lg border border-base-content/10 p-3' aria-label='실제 종이 넘김 소리'>
  <div className='flex items-center justify-between gap-2'>
   <strong className='text-sm'>페이지 넘김 소리</strong>
   <input type='checkbox' className='toggle toggle-primary' aria-label='페이지 넘김 소리 활성화'
    checked={config.enabled} disabled={saving||!storeSettings}
    onChange={e=>void update({...config,enabled:e.target.checked})}/>
  </div>
  <div className='flex items-center gap-2'>
   <select className='select select-bordered min-w-0 flex-1' aria-label='종이 넘김 음원 선택'
    value={config.selected} disabled={saving||!storeSettings}
    onChange={e=>void update({...config,selected:e.target.value})}>
    {[...PAPER_SOUNDS,...config.files].map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select>
   <button type='button' className='btn btn-outline btn-sm' onClick={()=>playPageSound(config,true)}>▶ 미리 듣기</button>
   <button type='button' className='btn btn-ghost btn-sm' onClick={()=>input.current?.click()}>+ 음원</button>
  </div>
  <label className='flex items-center justify-between gap-2 text-sm' htmlFor='personal-page-volume'>
   <span>음량</span><strong className='tabular-nums'>{draftVolume??config.volume}%</strong>
  </label>
  <input type='range' id='personal-page-volume' aria-label='페이지 넘김 음량'
   className='range range-primary range-sm w-full' min={0} max={100} step={5}
   disabled={saving||!storeSettings}
   value={draftVolume??config.volume}
   onChange={e=>{const value=Number(e.target.value);pendingVolume.current=value;setDraftVolume(value);}}
   onPointerUp={commitVolume} onTouchEnd={commitVolume} onKeyUp={commitVolume} onBlur={commitVolume}/>
  <input type='file' ref={input} className='hidden' accept='audio/*,.wav,.mp3,.ogg,.m4a'
    onChange={e=>{const f=e.target.files?.[0];if(f)void addAudio(f);e.target.value='';}}/>
  {config.files.some(file=>file.id===config.selected)&&
   <button className='btn btn-ghost btn-xs text-error' type='button' onClick={()=>void update({
    ...config,selected:'paper',files:config.files.filter(f=>f.id!==config.selected)
   })}>사용자 음원 삭제</button>}
  {error&&<p role='alert' className='text-error text-xs'>{error}</p>}
  <p className='text-xs opacity-65'>
   전자음 대신 실제 종이 넘김 녹음 3종을 제공합니다. 설정 음량은 저장되며,
   사용자 음원은 12KB 이하 최대 3개이며, AI 템플릿과 합쳐 서버 설정 24KB 이내에서 동기화합니다.
   휴대전화 자체의 미디어 음량도 소리에 영향을 줍니다.
  </p>
 </section>;
}
