import * as React from 'react';
import { useState } from 'react';
import { PiX } from 'react-icons/pi';
import { MdAdd, MdClose } from 'react-icons/md';
import type { Book } from '@/types/book';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';
import {
  appendCustomStatus, catalogItems, persistStatusCatalog,
  usePersonalStatusCatalog,
} from '@/utils/personalShelfStatuses';

interface Props {
  books: Book[];
  selectedCount: number;
  safeAreaBottom: number;
  onCancel: () => void;
  onApplyStatus: (status: string | null) => Promise<void>;
  onDeleteCustomStatus: (status: string) => Promise<void>;
}

export default function SetStatusAlert({
  books, selectedCount, safeAreaBottom, onCancel,
  onApplyStatus, onDeleteCustomStatus,
}: Props) {
  const divRef = useKeyDownActions({onCancel});
  const catalog = usePersonalStatusCatalog(books);
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = async (id: string | null) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onApplyStatus(id); }
    catch (e) {setError(e instanceof Error ? e.message : String(e));}
    finally {setBusy(false);}
  };

  const create = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = appendCustomStatus(catalog, customName);
      const name = customName.trim().replace(/\s+/g, ' ');
      persistStatusCatalog(next);
      setCustomName('');
      await onApplyStatus('custom:' + name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {setBusy(false);}
  };

  return <div ref={divRef}
    className='status-alert fixed inset-x-0 bottom-0 z-50 flex justify-center'
    style={{paddingBottom: safeAreaBottom + 16}}>
    <div className='border-base-content/10 bg-base-200/95 flex max-h-[76vh] w-[min(94vw,560px)] flex-col gap-3 overflow-hidden rounded-2xl border p-4 shadow-xl backdrop-blur-xs'>
      <div className='flex shrink-0 items-center justify-between gap-3'>
        <h3 className='text-sm font-semibold'>책 {selectedCount}권 상태 설정</h3>
        <button type='button' className='btn btn-ghost btn-sm rounded-full'
          onClick={onCancel} aria-label='닫기'><PiX size={20}/></button>
      </div>
      <p className='text-base-content/65 shrink-0 text-xs'>책장 필터와 동일한 상태 목록입니다.</p>
      <div className='grid min-h-0 grid-cols-2 gap-2 overflow-y-auto pr-1'>
        {catalogItems(catalog).filter(item => item.assignable).map(item => (
          <div key={item.id} className='flex min-w-0 items-center gap-1'>
            <button type='button' disabled={busy} onClick={() => void apply(item.id)}
              className='border-base-content/15 bg-base-300/60 hover:bg-base-300 min-h-11 min-w-0 flex-1 truncate rounded-xl border px-3 text-sm font-medium transition-colors'>
              {item.label}
            </button>
            {!item.required && <button type='button' disabled={busy}
              aria-label={'상태 삭제: ' + item.label}
              title={'상태 삭제: ' + item.label}
              className='btn btn-ghost btn-xs shrink-0'
              onClick={() => {
                if (window.confirm('이 상태를 삭제하고 책에 붙은 해당 상태도 해제할까요?')) {
                  void onDeleteCustomStatus(item.id).catch(e =>
                    setError(e instanceof Error ? e.message : String(e)));
                }
              }}><MdClose size={15}/></button>}
          </div>
        ))}
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        <input aria-label='사용자 상태 이름' className='input input-bordered min-w-0 flex-1 text-sm'
          value={customName} onChange={event => setCustomName(event.target.value)}
          maxLength={32} placeholder='사용자 지정 상태 추가…'
          onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); void create();}}}/>
        <button type='button' className='btn btn-primary btn-sm shrink-0'
          disabled={!customName.trim() || busy} onClick={() => void create()}>
          <MdAdd size={18}/> 추가
        </button>
      </div>
      <button type='button' disabled={busy} onClick={() => void apply(null)}
        className='border-base-content/15 bg-base-100/70 min-h-10 shrink-0 rounded-xl border text-sm'>
        상태 지우기
      </button>
      {error && <p role='alert' className='text-error text-xs'>{error}</p>}
    </div>
  </div>;
}
