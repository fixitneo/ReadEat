'use client';
import React, { useState } from 'react';
import { RiArchiveLine, RiDownloadCloud2Line, RiUploadCloud2Line, RiRestartLine } from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useFileSelector } from '@/hooks/useFileSelector';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { restoreFromBackupZip, saveBackupFile } from '@/services/backupService';
import {
  DEFAULT_PERSONAL_BACKUP, PERSONAL_BACKUP_KEYS, PERSONAL_BACKUP_MANIFEST,
  readPersonalManifest, type PersonalBackupSelection,
} from '@/utils/personalBackupSelection';

const LABELS: Record<keyof PersonalBackupSelection, {title:string; description:string}> = {
  bookFiles: {title:'책 원본 파일',description:'기기에 다운로드되거나 보관된 EPUB, PDF 등 실제 파일'},
  serverBooks: {title:'서버 오프라인 파일',description:'서버에서 내려받아 기기에 저장된 오디오/책 파일 포함 (서버에만 있는 파일은 미포함)'},
  bookmarks: {title:'북마크',description:'책마다 표시한 책갈피'},
  annotations: {title:'하이라이트 · 주석 · 손글씨',description:'선택한 구절, 펜 필기, 표시 및 주석'},
  notes: {title:'메모 · 발췌',description:'책별 노트북과 발췌한 기록'},
  readingPositions: {title:'읽은 위치 · 진행률',description:'마지막 위치, CFI, 페이지 및 책별 진행 정보'},
  css: {title:'CSS 파일 · 적용 상태',description:'불러온 CSS 파일 내용, 선택된 스타일과 사용 여부'},
  layouts: {title:'레이아웃 · 글꼴 · 화면 설정',description:'접기/펼치기 레이아웃, 3×3 터치, 책별·전체 보기 설정'},
  serverSettings: {title:'서버 · 계정 연결 설정',description:'OPDS, Audiobookshelf, WebDAV, S3 등 저장된 연결 구성'},
  appSettings: {title:'기타 앱 설정',description:'페이지 넘김 소리, 책장 구성, 앱 환경설정 및 추가 개인 설정'},
  statistics: {title:'독서 통계',description:'읽은 시간과 통계 기록'},
  credentials: {title:'비밀번호 · API 키 · 토큰',description:'암호화되지 않은 ZIP에 민감한 계정 정보가 들어갈 수 있습니다'},
};
const KEY_ORDER: (keyof PersonalBackupSelection)[] = [
  'bookFiles','serverBooks','bookmarks','annotations','notes','readingPositions',
  'css','layouts','serverSettings','appSettings','statistics','credentials',
];

type State = 'idle' | 'exporting' | 'importing' | 'done' | 'error';
export default function PersonalBackupPanel() {
  const _ = useTranslation();
  const {appService} = useEnv();
  const {selectFiles} = useFileSelector(appService, _);
  const setLibrary = useLibraryStore(s => s.setLibrary);
  const [selected,setSelected] = useState<PersonalBackupSelection>(DEFAULT_PERSONAL_BACKUP);
  const [status,setStatus] = useState<State>('idle');
  const [progress,setProgress] = useState({current:0,total:0,filename:''});
  const [message,setMessage] = useState('');
  const [restoreComplete,setRestoreComplete] = useState(false);
  const [reviewOpen,setReviewOpen] = useState(false);
  const busy=status==='exporting'||status==='importing';
  useScreenWakeLock(busy,appService?.hasWindow,appService?.isIOSApp);
  const update=(key:keyof PersonalBackupSelection,checked:boolean)=>{
    setSelected(prev=>({...prev,[key]:checked}));
  };
  const all=(checked:boolean)=>{
    setSelected(Object.fromEntries(PERSONAL_BACKUP_KEYS.map(k=>[k,k==='credentials'?false:checked])) as unknown as PersonalBackupSelection);
  };
  const exportZip=async()=>{
    if(!appService) return;
    setStatus('exporting');setMessage('');setProgress({current:0,total:0,filename:''});
    try {
      const filename='ReadestPersonal-'+new Date().toISOString().slice(0,10)+'.zip';
      const choice={...selected};
      if (choice.credentials && !choice.serverSettings && !choice.appSettings) choice.credentials=false;
      const saved=await saveBackupFile(appService,filename,
        {includeCredentials:choice.credentials,selection:choice},
        (current,total,filename)=>setProgress({current,total,filename}));
      if(!saved){setStatus('idle');return;}
      setMessage('선택한 항목을 ZIP 파일로 저장했습니다.');
      setRestoreComplete(false);
      setStatus('done');
    }catch(e){setMessage(e instanceof Error?e.message:String(e));setStatus('error');}
  };
  const importZip=async()=>{
    if(!appService) return;
    try {
      const result=await selectFiles({
        type:'generic',accept:'.zip',extensions:['zip'],dialogTitle:'Readest 백업 선택',
      });
      if(!result.files.length)return;
      const selectedFile=result.files[0]!;
      const file=selectedFile.file??await appService.openFile(selectedFile.path!,'None');
      // Preview archive metadata before touching any live data.
      const {BlobReader,ZipReader,Uint8ArrayWriter}=await import('@zip.js/zip.js');
      const reader=new ZipReader(new BlobReader(file));
      let summary='Readest 기존 ZIP 백업';
      try {
        const entries=await reader.getEntries();
        if(!entries.some(e=>e.filename==='library.json'))throw new Error('Readest ZIP 백업이 아닙니다.');
        const personal=entries.find(e=>e.filename===PERSONAL_BACKUP_MANIFEST);
        if(personal && 'getData' in personal){
          if((personal.uncompressedSize??0)>65536)throw new Error('백업 manifest가 너무 큽니다.');
          const bytes=await personal.getData!(new Uint8ArrayWriter());
          const selection=readPersonalManifest(JSON.parse(new TextDecoder().decode(bytes)));
          summary='복원 항목: '+KEY_ORDER.filter(k=>selection[k]).map(k=>LABELS[k].title).join(', ');
        }
      }finally{await reader.close();}
      if(!window.confirm(summary+'\n\n기존 항목과 병합하여 복원할까요? 복원 중에는 앱을 종료하지 마세요.'))return;
      setStatus('importing');setMessage('');setProgress({current:0,total:0,filename:''});
      const {booksAdded,booksUpdated,settingsRestored}=await restoreFromBackupZip(
        appService,file,(current,total,filename)=>setProgress({current,total,filename}),
        selectedFile.path);
      setLibrary(await appService.loadLibraryBooks());
      setRestoreComplete(true);
      setStatus('done');
      setMessage('복원 완료 · 추가 '+booksAdded+'권 · 갱신 '+booksUpdated+
        '권 · 앱 설정 '+(settingsRestored?'복원됨':'변경 없음')+
        '. 설정을 화면에 반영하려면 앱을 새로고침하세요.');
    }catch(e){setMessage(e instanceof Error?e.message:String(e));setStatus('error');}
  };
  const percent=progress.total>0?Math.min(100,Math.round(progress.current/progress.total*100)):0;
  return <div className='mx-auto flex w-full max-w-[680px] flex-col gap-4 px-4 pb-8 pt-5'>
    <div className='flex items-center gap-2'>
      <RiArchiveLine className='h-6 w-6 shrink-0'/>
      <div><h2 className='text-base font-semibold'>전체 백업 · 설정 복원</h2>
        <p className='text-base-content/60 text-xs'>항목을 선택하여 한 개의 ZIP 파일로 내보내고 다시 복원합니다.</p>
      </div>
    </div>
    <div className='flex gap-2'>
      <button type='button' disabled={busy} className='btn btn-ghost btn-sm flex-1' onClick={()=>all(true)}>모두 선택 (비밀번호 제외)</button>
      <button type='button' disabled={busy} className='btn btn-ghost btn-sm flex-1' onClick={()=>all(false)}>모두 해제</button>
    </div>
    <div className='divide-base-content/10 divide-y rounded-2xl border border-base-content/10'>
      {KEY_ORDER.map(key=><label key={key} className='flex cursor-pointer items-center gap-3 p-3'>
        <span className='min-w-0 flex-1'>
          <span className='block text-sm font-medium'>{LABELS[key].title}</span>
          <span className='block text-xs opacity-65'>{LABELS[key].description}</span>
        </span>
        <input type='checkbox' className='toggle toggle-primary shrink-0' aria-label={LABELS[key].title}
          disabled={busy||(key==='serverBooks'&&!selected.bookFiles)}
          checked={selected[key]} onChange={e=>update(key,e.target.checked)}/>
      </label>)}
    </div>
    <p className='text-base-content/65 text-xs'>서버 설정은 연결 구성의 스냅샷입니다. 서버에만 존재하는 책은 먼저 내려받아야 원본 파일이 백업됩니다. 보안상 기기 식별자, 저장 경로, 동기화 커서는 복원하지 않습니다.</p>
    {selected.credentials&&<p role='alert' className='text-warning text-xs font-medium'>
      주의: 서버 비밀번호/API 키 등이 일반 ZIP 파일에 저장됩니다. 신뢰할 수 있는 장소에만 보관하세요.
    </p>}
    <button type='button' disabled={busy||!PERSONAL_BACKUP_KEYS.some(k=>selected[k]&&k!=='credentials'&&k!=='serverBooks')}
      onClick={()=>void exportZip()} className='btn btn-primary w-full gap-2'>
      <RiUploadCloud2Line/> 선택 항목 한 번에 내보내기
    </button>
    <button type='button' disabled={busy} onClick={()=>setReviewOpen(x=>!x)}
      className='btn btn-outline w-full gap-2'>
      <RiDownloadCloud2Line/> ZIP에서 설정 들여오기 {reviewOpen?'▴':'▾'}
    </button>
    {reviewOpen&&<div className='space-y-3 rounded-xl border border-base-content/10 p-3'>
      <p className='text-xs opacity-75'>이 앱에서 만든 백업은 선택했던 항목만 복원됩니다. 기존 Readest ZIP도 가져올 수 있습니다. 기존 책과 주석은 병합하고, 같은 이름의 앱 설정은 덮어쓸 수 있습니다.</p>
      <button type='button' disabled={busy} onClick={()=>void importZip()} className='btn btn-primary btn-outline w-full'>백업 ZIP 선택 · 미리보기 · 복원</button>
    </div>}
    {busy&&<div role='status' className='space-y-2'>
      <div className='flex items-center justify-between text-xs'>
        <span>{status==='exporting'?'백업하는 중':'복원하는 중'}</span><span>{percent}%</span>
      </div>
      <progress className='progress progress-primary w-full' max={100} value={percent}/>
      <p className='truncate text-xs opacity-60'>{progress.filename||'준비 중...'}</p>
    </div>}
    {(status==='done'||status==='error')&&<p role='status' className={'rounded-xl border p-3 text-sm '+(status==='error'?'border-error/40 text-error':'border-base-content/15')}>{message}</p>}
    {restoreComplete&&<button type='button' className='btn btn-outline w-full gap-2'
      onClick={()=>window.location.reload()}><RiRestartLine/> 복원한 설정 적용하기</button>}
  </div>;
}
