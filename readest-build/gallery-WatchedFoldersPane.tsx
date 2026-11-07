import React,{useState} from 'react';
import {MdArrowBackIosNew,MdArrowForwardIos} from 'react-icons/md';
import {useTranslation} from '@/hooks/useTranslation';
import {getDirFromUILanguage} from '@/utils/rtl';
import {getFilename} from '@/utils/path';
import BoxedList from '@/components/settings/primitives/BoxedList';
import SettingsSelect from '@/components/settings/primitives/SettingsSelect';
export interface WatchedFolder {path:string;flatten:boolean;}
interface WatchedFoldersPaneProps {
 folders:WatchedFolder[];onBack:()=>void;
 onUnwatch:(path:string)=>void|Promise<void>;
 onSetFlatten:(path:string,flatten:boolean)=>void|Promise<void>;
 onReplace?:(path:string)=>void|Promise<void>;
}
export default function WatchedFoldersPane({folders,onBack,onUnwatch,onSetFlatten,onReplace}:WatchedFoldersPaneProps){
 const _=useTranslation(),BackIcon=getDirFromUILanguage()==='rtl'?MdArrowForwardIos:MdArrowBackIosNew;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<string|null>(null);
 const run=async(action:()=>void|Promise<void>)=>{setBusy(true);setError('');try{await action();setPending(null);}catch(e){setError(e instanceof Error?e.message:'폴더 설정을 저장하지 못했습니다.');}finally{setBusy(false);}};
 return <div className='flex flex-col gap-3 pt-2'>
  <div className='flex items-center gap-2'>
   <button type='button' className='btn btn-ghost btn-sm px-1' aria-label={_('Back')} onClick={onBack} disabled={busy}><BackIcon className='h-4 w-4'/></button>
   <span className='text-base font-semibold'>감시 폴더 관리</span>
  </div>
  <p className='text-sm opacity-70'>폴더 경로와 정리 방식을 변경하거나 삭제할 수 있습니다. 삭제하면 그 폴더에 연결된 책이 책장에서 제거됩니다. 원본 파일은 유지됩니다.</p>
  {error&&<p role='alert' className='text-error text-sm'>{error}</p>}
  {!folders.length?<p className='py-4 text-center opacity-70'>감시 중인 폴더가 없습니다.</p>:<BoxedList>
   {folders.map(folder=><div key={folder.path} className='space-y-2 py-3' data-watched-folder={folder.path}>
    <div className='min-w-0 px-2'><div className='truncate font-medium'>{getFilename(folder.path)||folder.path}</div><div className='break-all text-xs opacity-65'>{folder.path}</div></div>
    <div className='flex flex-wrap items-center gap-2 px-2'>
     <SettingsSelect value={folder.flatten?'flatten':'keep'} disabled={busy}
      onChange={e=>void run(()=>onSetFlatten(folder.path,e.target.value==='flatten'))}
      options={[{value:'keep',label:_('Groups')},{value:'flatten',label:_('Flat')}]}
      ariaLabel={_('Folder Structure')}/>
     <button type='button' className='btn btn-outline btn-sm' disabled={busy||!onReplace} onClick={()=>void run(()=>onReplace?.(folder.path))}>폴더 변경</button>
     <button type='button' className='btn btn-ghost btn-sm text-error' disabled={busy} onClick={()=>setPending(folder.path)} aria-label='감시 폴더 삭제'>삭제</button>
    </div>
    {pending===folder.path&&<div className='rounded-lg bg-base-200 p-3 text-sm' role='alert'>
     <p>이 폴더에서 가져온 책을 모두 책장에서 제거할까요? 다른 경로에도 연결된 같은 책도 제거됩니다. 원본 파일은 삭제하지 않습니다.</p>
     <div className='mt-2 flex justify-end gap-2'>
      <button type='button' className='btn btn-ghost btn-sm' disabled={busy} onClick={()=>setPending(null)}>취소</button>
      <button type='button' className='btn btn-error btn-sm' disabled={busy} onClick={()=>void run(()=>onUnwatch(folder.path))}>폴더 및 연결된 책 제거</button>
     </div>
    </div>}
   </div>)}
  </BoxedList>}
 </div>;
}
