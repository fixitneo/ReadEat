import {useEffect,useState} from 'react';
import {useEnv} from '@/context/EnvContext';
import {validatePersonalProfileBudget} from '@/utils/personalProfileBudget';
import {useSettingsStore} from '@/store/settingsStore';
import {
 DEFAULT_PERSONAL_AI_TEMPLATES, loadPersonalAITemplates, savePersonalAITemplates,
 normalizeAITemplates,
 type PersonalAITemplate,
} from '@/utils/personalAIQuick';

export default function PersonalAIPromptSettings(){
 const {envConfig}=useEnv();
 const syncedTemplates=useSettingsStore(s=>s.settings?.personalProfile?.aiTemplates);
 const setSettings=useSettingsStore(s=>s.setSettings);
 const saveSettings=useSettingsStore(s=>s.saveSettings);
 const [dirty,setDirty]=useState(false);
 const [templates,setTemplates]=useState<PersonalAITemplate[]>(()=>normalizeAITemplates(syncedTemplates??loadPersonalAITemplates()));
 useEffect(()=>{
  if(syncedTemplates&&!dirty)setTemplates(normalizeAITemplates(syncedTemplates));
 },[syncedTemplates,dirty]);
 const [active,setActive]=useState(templates[0]?.id??'');
 const selected=templates.find(t=>t.id===active)??templates[0];
 const [notice,setNotice]=useState('');
 const edit=(patch:Partial<PersonalAITemplate>)=>{
  setTemplates(previous=>previous.map(t=>t.id===selected?.id?{...t,...patch}:t));
  setDirty(true);setNotice('저장되지 않은 변경 사항');
 };
 const save=async()=>{
  const current=useSettingsStore.getState().settings;
  if(!current){setNotice('설정을 불러온 후 다시 시도해 주세요.');return;}
  const normalized=normalizeAITemplates(templates);
  try{
   const next={...current,personalProfile:{...current.personalProfile,aiTemplates:normalized}};
   validatePersonalProfileBudget(next.personalProfile);
   setSettings(next);
   await saveSettings(envConfig,next);
   savePersonalAITemplates(normalized); // legacy local cache / ZIP compatibility
   setTemplates(normalized);
   setDirty(false);
   setNotice('템플릿 저장 완료 · 서버 설정 동기화에 포함됨');
  }catch(error){setNotice('템플릿 저장 실패: '+String(error));}
 };
 const add=()=>{
  if(templates.length>=24)return;
  const next={id:'prompt-'+Date.now(),name:'새 템플릿',scope:'both' as const,
    body:'다음 책 또는 인용을 분석해 줘.\n{author} - {title} ({publisher})\n{text}\n{books}'};
  setTemplates(old=>[...old,next]);setActive(next.id);setDirty(true);setNotice('저장되지 않은 변경 사항');
 };
 return <section className='border-base-content/10 rounded-xl border p-4' aria-label='AI 질문 템플릿'>
  <div className='mb-2 flex items-center justify-between gap-2'>
   <h3 className='text-base font-semibold'>책장 · 텍스트 선택 AI 템플릿</h3>
   <button type='button' className='btn btn-sm btn-outline' disabled={templates.length>=24} onClick={add}>+ 템플릿</button>
  </div>
  <p className='text-base-content/65 mb-3 text-xs'>
   책 선택과 텍스트 선택에서 사용할 AI 질문을 작성합니다. 선택한 템플릿은 AI 전송 직전에 편집할 수도 있습니다.
  </p>
  <div className='flex flex-col gap-2'>
   <label className='text-sm'>편집할 템플릿
    <select className='select select-bordered mt-1 w-full' value={selected?.id??''}
      onChange={e=>setActive(e.target.value)}>
      {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
   </label>
   {selected&&<>
    <label className='text-sm'>이름
     <input className='input input-bordered mt-1 w-full' maxLength={60}
      value={selected.name} onChange={e=>edit({name:e.target.value})}/>
    </label>
    <label className='text-sm'>표시할 곳
     <select className='select select-bordered mt-1 w-full' value={selected.scope}
      onChange={e=>edit({scope:e.target.value as PersonalAITemplate['scope']})}>
      <option value='book'>책 · 그룹</option><option value='quote'>선택한 텍스트</option><option value='both'>둘 다</option>
     </select>
    </label>
    <label className='text-sm'>프롬프트
     <textarea className='textarea textarea-bordered mt-1 min-h-40 w-full font-mono text-xs'
      value={selected.body} maxLength={12000} onChange={e=>edit({body:e.target.value})} rows={7}/>
    </label>
    <div className='text-base-content/60 text-xs'>지원 변수: {'{title}'} · {'{author}'} · {'{publisher}'} · {'{text}'} · {'{books}'}</div>
    <div className='flex flex-wrap justify-end gap-2'>
     <button type='button' className='btn btn-ghost btn-sm' onClick={()=>{
      const changed=templates.filter(t=>t.id!==selected.id);setTemplates(changed);
      setActive(changed[0]?.id??'');setDirty(true);setNotice('저장되지 않은 변경 사항');
     }} disabled={templates.length<=1}>템플릿 삭제</button>
     <button type='button' className='btn btn-ghost btn-sm'
      onClick={()=>{setTemplates([...DEFAULT_PERSONAL_AI_TEMPLATES]);setActive(DEFAULT_PERSONAL_AI_TEMPLATES[0]!.id);setDirty(true);setNotice('기본값으로 재설정됨 · 저장 필요');}}>
      기본값 복원
     </button>
     <button type='button' className='btn btn-primary btn-sm'
      onClick={()=>void save()}>저장</button>
    </div>
   </>}
  </div>
  {notice&&<p role='status' className='mt-2 text-xs'>{notice}</p>}
 </section>;
}
