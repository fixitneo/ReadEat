'use client';
import React,{useEffect,useRef,useState} from 'react';
import {useEnv} from '@/context/EnvContext';
import {useSettingsStore} from '@/store/settingsStore';
import {currentFoldMode} from '@/utils/personalControlsConfig';
import {
  DEFAULT_BACKGROUND_CROP,backgroundCropKey,normalizeBackgroundCrop,
  setBackgroundCropVariables,type BackgroundCrop,
} from '@/utils/personalBackgroundCrop';

type Mode='folded'|'unfolded';
type PointerStart={id:number;x:number;y:number;crop:BackgroundCrop};
export default function PersonalBackgroundCrop({textureId,imageSrc}:{
  textureId:string;imageSrc:string;
}){
  const {envConfig}=useEnv();
  const crops=useSettingsStore(s=>s.settings.personalProfile?.backgroundCrops);
  const [mode,setMode]=useState<Mode>(()=>currentFoldMode());
  const [edit,setEdit]=useState<BackgroundCrop>(DEFAULT_BACKGROUND_CROP);
  const dragging=useRef<PointerStart|null>(null);
  const viewport=useRef<HTMLDivElement|null>(null);
  const profileKey=backgroundCropKey(textureId,mode);
  useEffect(()=>{
    setEdit(normalizeBackgroundCrop(crops?.[profileKey]));
  },[profileKey,crops]);
  if(!imageSrc)return null;
  const zoomTo=(value:number)=>{
    const next=normalizeBackgroundCrop({...edit,zoom:value});
    setEdit(next);
  };
  const save=async()=>{
    const state=useSettingsStore.getState();
    const next={...state.settings,personalProfile:{
      ...state.settings.personalProfile,
      backgroundCrops:{...state.settings.personalProfile?.backgroundCrops,
        [profileKey]:normalizeBackgroundCrop(edit)},
    }};
    state.setSettings(next);
    await state.saveSettings(envConfig,next);
    if(currentFoldMode()===mode){
      setBackgroundCropVariables(textureId,next.personalProfile.backgroundCrops);
    }
  };
  const start=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(e.pointerType==='mouse' && e.button!==0)return;
    dragging.current={id:e.pointerId,x:e.clientX,y:e.clientY,crop:edit};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move=(e:React.PointerEvent<HTMLDivElement>)=>{
    const start=dragging.current;
    if(!start || start.id!==e.pointerId)return;
    const rect=viewport.current?.getBoundingClientRect();
    if(!rect || !rect.width || !rect.height)return;
    setEdit(normalizeBackgroundCrop({...start.crop,
      x:start.crop.x+(e.clientX-start.x)/rect.width*100,
      y:start.crop.y+(e.clientY-start.y)/rect.height*100,
    }));
  };
  const finish=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(dragging.current?.id===e.pointerId)dragging.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const folded=mode==='folded';
  return <section className='mt-4 space-y-3 rounded-xl border border-base-content/15 p-3' data-no-settings-swipe>
    <h3 className='font-semibold'>배경 사진 구도 조절</h3>
    <p className='text-sm opacity-75'>화면 테두리는 고정됩니다. 사진을 끌어 위치를 바꾸고 확대 막대로 잘라낼 부분을 고르세요.</p>
    <div className='flex gap-2'>
      <button type='button' className={'btn btn-sm '+(folded?'btn-primary':'btn-outline')} aria-pressed={folded}
        onClick={()=>setMode('folded')}>접힌 화면</button>
      <button type='button' className={'btn btn-sm '+(!folded?'btn-primary':'btn-outline')} aria-pressed={!folded}
        onClick={()=>setMode('unfolded')}>펼친 화면</button>
    </div>
    <div ref={viewport} role='img' aria-label='배경 사진을 드래그하여 자를 영역 미리보기'
      className='relative mx-auto w-full max-w-[360px] touch-none select-none overflow-hidden rounded-xl border-2 border-base-content/50 bg-base-200'
      style={{aspectRatio:folded?'9 / 20':'1 / 1'}}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
      onWheel={e=>{if(e.ctrlKey){e.preventDefault();zoomTo(edit.zoom+(e.deltaY<0?.1:-.1));}}}>
      <img draggable={false} alt='' src={imageSrc}
        className='pointer-events-none absolute inset-0 h-full w-full object-cover'
        style={{transform:`translate(${edit.x}%,${edit.y}%) scale(${edit.zoom})`,transformOrigin:'center'}}/>
      <div className='pointer-events-none absolute inset-0 border border-white/40'/>
    </div>
    <label className='flex items-center gap-3 text-sm'>
      <span className='whitespace-nowrap'>사진 확대</span>
      <input type='range' className='range range-sm min-w-0 flex-1' min={1} max={3} step={0.05} value={edit.zoom}
        aria-label='배경 사진 확대 비율' onChange={e=>zoomTo(Number(e.target.value))}/>
      <span className='w-12 text-right'>{Math.round(edit.zoom*100)}%</span>
    </label>
    <div className='flex justify-end gap-2'>
      <button type='button' className='btn btn-outline btn-sm'
        onClick={()=>setEdit(DEFAULT_BACKGROUND_CROP)}>초기화</button>
      <button type='button' className='btn btn-primary btn-sm' onClick={()=>void save()}>이 화면 구도 저장</button>
    </div>
    <p className='text-xs opacity-70'>접힌 화면과 펼친 화면의 구도는 각각 저장됩니다. 다른 기기에서도 화면 비율은 달라질 수 있습니다.</p>
  </section>;
}
