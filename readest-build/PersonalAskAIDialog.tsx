import {useState} from 'react';
import {createPortal} from 'react-dom';
import {generateText} from 'ai';
import {MdClose, MdContentCopy} from 'react-icons/md';
import {useSettingsStore} from '@/store/settingsStore';
import {getAIProvider} from '@/services/ai/providers';
import type {Book} from '@/types/book';
import {
 DEFAULT_PERSONAL_AI_TEMPLATES, fillPersonalAIPrompt,
 loadPersonalAITemplates, normalizeAITemplates, type AskScope, type PersonalAITemplate,
} from '@/utils/personalAIQuick';

interface Props {books:Book[]; quote?:string; onClose:()=>void;}
export default function PersonalAskAIDialog({books,quote,onClose}:Props) {
 const scope:AskScope=quote?'quote':'book';
 const synced=useSettingsStore(s=>s.settings?.personalProfile?.aiTemplates);
 const available=normalizeAITemplates(synced??loadPersonalAITemplates()).filter(template=>template.scope==='both'||template.scope===scope);
 const presets=available.length?available:DEFAULT_PERSONAL_AI_TEMPLATES.filter(t=>t.scope===scope);
 const [choice,setChoice]=useState<PersonalAITemplate>(presets[0]!);
 const [prompt,setPrompt]=useState(()=>fillPersonalAIPrompt(presets[0]!.body,books,quote));
 const [result,setResult]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const {settings}=useSettingsStore();
 const [submitted,setSubmitted]=useState(false);
 const [abort]=useState(()=>new AbortController());
 const ai=settings.aiSettings;
 const enabled=!!ai?.enabled;
 const choose=(id:string)=>{
  const found=presets.find(t=>t.id===id);
  if(!found)return;
  setChoice(found);setPrompt(fillPersonalAIPrompt(found.body,books,quote));
  setResult('');setError('');setSubmitted(false);
 };
 const run=async()=>{
  if(!enabled||!ai){setError('설정 → AI에서 제공자와 모델을 먼저 활성화하세요.');return;}
  if(!prompt.trim()||busy)return;
  setBusy(true);setError('');setResult('');setSubmitted(true);
  try{
   const provider=getAIProvider(ai);
   const response=await generateText({model:provider.getModel(),prompt:prompt.slice(0,24000),
    abortSignal:abort.signal});
   setResult(response.text||'AI가 빈 답변을 반환했습니다.');
  }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
  finally{setBusy(false);}
 };
 const close=()=>{abort.abort();onClose();};
 return typeof document==='undefined'?null:createPortal(
  <div className='fixed inset-0 z-[10010] flex items-end justify-center bg-black/55 p-2 pb-[env(safe-area-inset-bottom)] sm:items-center'
    role='presentation' onPointerDown={e=>{if(e.target===e.currentTarget)close();}}>
   <div role='dialog' aria-modal='true' aria-label='AI에게 물어보기'
     className='bg-base-100 border-base-content/15 flex max-h-[92dvh] w-full max-w-[680px] flex-col gap-3 overflow-y-auto rounded-2xl border p-4 shadow-2xl'>
    <div className='flex items-center justify-between'>
     <h2 className='text-base font-semibold'>AI에게 물어보기</h2>
     <button type='button' className='btn btn-ghost btn-sm' aria-label='닫기' onClick={close}><MdClose size={20}/></button>
    </div>
    <p className='text-base-content/65 text-xs'>
     {quote?'선택한 구절과 해당 책의 메타데이터만 사용합니다.':'선택한 책의 제목·저자·출판사 등 메타데이터만 사용합니다. 책 파일이나 본문 전체는 보내지 않습니다.'}
     {' '}전송할 내용은 아래에서 확인·수정할 수 있습니다.
    </p>
    <label className='flex flex-col gap-1 text-sm font-medium'>
     프롬프트 템플릿
     <select className='select select-bordered w-full' value={choice.id} onChange={event=>choose(event.target.value)}>
      {presets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
     </select>
    </label>
    <label className='flex flex-col gap-1 text-sm font-medium'>
     AI에게 보낼 메시지
     <textarea className='textarea textarea-bordered min-h-32 w-full text-sm'
      rows={6} maxLength={24000} value={prompt} onChange={event=>setPrompt(event.target.value)}/>
    </label>
    <div className='text-base-content/60 text-xs'>
     사용 제공자: {enabled?ai?.provider:'연결하지 않음'} · 외부 API 사용 시 비용이나 개인정보 전송이 발생할 수 있습니다.
    </div>
    <button type='button' className='btn btn-primary w-full' disabled={busy||!prompt.trim()||!enabled}
     onClick={()=>void run()}>{busy?'답변 생성 중…':'확인 후 AI에 보내기'}</button>
    {!enabled&&<p role='alert' className='text-warning text-xs'>설정 → AI에서 Ollama 또는 OpenAI 호환 API를 연결하고 활성화하세요.</p>}
    {error&&<p role='alert' className='text-error break-words text-sm'>{error}</p>}
    {(result||submitted)&&<section aria-label='AI 답변' className='bg-base-200/60 flex flex-col gap-2 rounded-xl p-3'>
     <div className='flex items-center justify-between text-sm font-semibold'>
      AI 답변
      {result&&<button type='button' className='btn btn-ghost btn-xs'
        onClick={()=>void navigator.clipboard.writeText(result)}><MdContentCopy/> 복사</button>}
     </div>
     <div className='max-h-[35vh] overflow-y-auto whitespace-pre-wrap break-words text-sm'>
      {result||(!error?'답변을 기다리는 중입니다.':'')}
     </div>
    </section>}
   </div>
  </div>,document.body
 );
}
