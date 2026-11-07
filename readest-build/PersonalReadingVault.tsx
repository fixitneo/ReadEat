'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLibraryStore } from '@/store/libraryStore';
import {
  READING_VAULT_CHANGED, READING_VAULT_KEY,
  readReadingVault, removeReadingVaultEntry, saveReadingVaultEntry,
  sortReadingVault, updateReadingVaultMemo,
  type ReadingVaultEntry, type ReadingVaultKind,
} from '@/utils/personalReadingVault';

type Order = 'az' | 'new' | 'old';

function VaultItem({ entry, onRefresh, onError }: {
  entry: ReadingVaultEntry;
  onRefresh: () => void;
  onError: (message: string) => void;
}) {
  const [memo, setMemo] = useState(entry.memo);
  useEffect(() => setMemo(entry.memo), [entry.memo]);
  const save = () => {
    try { updateReadingVaultMemo(entry.id, memo); onRefresh(); }
    catch (cause) { onError(String(cause)); }
  };
  const remove = () => {
    if (!window.confirm('이 항목을 삭제할까요?')) return;
    try { removeReadingVaultEntry(entry.id); onRefresh(); }
    catch (cause) { onError(String(cause)); }
  };
  return (
    <article className='border-base-300 rounded-xl border p-3' aria-label={entry.text}>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0 flex-1'>
          <strong className='break-words'>{entry.text}</strong>
          <p className='text-base-content/60 mt-1 text-xs'>{entry.bookTitle} · {new Date(entry.createdAt).toLocaleDateString('ko-KR')}</p>
        </div>
        <button type='button' className='btn btn-ghost btn-xs text-error' onClick={remove} aria-label='항목 삭제'>삭제</button>
      </div>
      {entry.quote && entry.quote !== entry.text && (
        <blockquote className='border-base-300 my-2 border-l-2 ps-2 text-xs opacity-75'>
          {entry.quote}
        </blockquote>
      )}
      <label className='mt-2 block text-xs' htmlFor={'vault-memo-' + entry.id}>메모 · 뜻풀이</label>
      <textarea
        id={'vault-memo-' + entry.id}
        className='textarea textarea-bordered mt-1 min-h-16 w-full'
        value={memo} maxLength={5000} onChange={(e) => setMemo(e.target.value)}
        onBlur={save} placeholder='뜻, 생각, 문맥 등을 기록하세요'
      />
      <div className='flex justify-end'>
        <button type='button' className='btn btn-outline btn-xs' onClick={save}>메모 저장</button>
      </div>
    </article>
  );
}

export function PersonalReadingVaultPanel({ mode, bookId }: {
  mode: ReadingVaultKind;
  bookId?: string;
}) {
  const library = useLibraryStore(s => s.library);
  const [all, setAll] = useState<ReadingVaultEntry[]>([]);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<Order>('new');
  const [newTitle, setNewTitle] = useState('');
  const [newMemo, setNewMemo] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    try { setAll(readReadingVault()); setError(''); }
    catch (cause) { setError(String(cause)); }
  }, []);
  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === READING_VAULT_KEY) refresh();
    };
    window.addEventListener(READING_VAULT_CHANGED, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(READING_VAULT_CHANGED, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const book = library.find(b => b.hash === bookId);
  const filtered = useMemo(() => sortReadingVault(all.filter(entry =>
    entry.kind === mode && (!bookId || entry.bookId === bookId) &&
    (entry.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
      entry.memo.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
      entry.bookTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  ), order), [all, mode, bookId, query, order]);

  const addNote = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      saveReadingVaultEntry({
        kind: 'note', text: newTitle, memo: newMemo,
        bookId: bookId || 'global',
        bookTitle: book?.title || (bookId ? '제목 없음' : '전체 노트'),
      });
      setNewTitle(''); setNewMemo(''); refresh();
    } catch (cause) { setError(String(cause)); }
  };
  return (
    <section className='flex h-full min-h-0 flex-col gap-3 p-3 text-base-content' aria-label={mode === 'word' ? '통합 단어장' : '독서 노트'}>
      {mode === 'note' && (
        <form className='border-base-300 flex shrink-0 flex-col gap-2 rounded-lg border p-3' onSubmit={addNote}>
          <label className='text-sm font-semibold' htmlFor='personal-new-note-title'>새 독서 노트</label>
          <input id='personal-new-note-title' className='input input-bordered w-full' required
            value={newTitle} maxLength={4000} placeholder='제목'
            onChange={e => setNewTitle(e.target.value)} />
          <textarea className='textarea textarea-bordered min-h-20 w-full'
            value={newMemo} maxLength={5000} placeholder='메모 내용'
            onChange={e => setNewMemo(e.target.value)} />
          <button className='btn btn-primary btn-sm self-end' type='submit'>노트 추가</button>
        </form>
      )}
      <div className='flex shrink-0 gap-2'>
        <input className='input input-bordered min-w-0 flex-1' aria-label='단어장 또는 노트 검색'
          placeholder='검색' value={query} onChange={e => setQuery(e.target.value)} />
        <select className='select select-bordered max-w-32' aria-label='정렬 방식' value={order}
          onChange={e => setOrder(e.target.value as Order)}>
          <option value='az'>ㄱㄴㄷ / A-Z</option>
          <option value='new'>저장일 최신순</option>
          <option value='old'>저장일 오래된순</option>
        </select>
      </div>
      {error && <p role='alert' className='text-error text-sm'>{error}</p>}
      <p className='shrink-0 text-xs opacity-60'>총 {filtered.length}개 · 이 기기 저장 · 백업에 포함 가능</p>
      <div className='min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-6'>
        {filtered.length === 0 && <p className='p-5 text-center text-sm opacity-60'>
          {mode === 'word' ? '책에서 단어를 선택하고 ‘단어장에 추가’를 누르세요.' : '독서 노트를 작성하면 여기에 모입니다.'}
        </p>}
        {filtered.map(entry =>
          <VaultItem key={entry.id} entry={entry} onRefresh={refresh} onError={setError} />
        )}
      </div>
    </section>
  );
}

export function PersonalReadingVaultPortal() {
  const [mode, setMode] = useState<ReadingVaultKind | null>(null);
  useEffect(() => {
    const show = (event: Event) => {
      const value = (event as CustomEvent<{ mode?: ReadingVaultKind }>).detail?.mode;
      if (value === 'word' || value === 'note') setMode(value);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMode(null); };
    window.addEventListener('readest-personal-open-vault', show);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('readest-personal-open-vault', show);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!mode) return null;
  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-3'
      role='presentation' onMouseDown={event => {
        if (event.target === event.currentTarget) setMode(null);
      }}>
      <div role='dialog' aria-modal='true' aria-label={mode === 'word' ? '통합 단어장' : '모든 독서 노트'}
        className='bg-base-100 text-base-content flex h-[min(90dvh,850px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl shadow-2xl'>
        <header className='border-base-300 flex items-center justify-between border-b px-4 py-3'>
          <h2 className='text-lg font-semibold'>{mode === 'word' ? '통합 단어장' : '독서 노트 · 전체 책'}</h2>
          <button type='button' className='btn btn-ghost btn-sm' onClick={() => setMode(null)} aria-label='닫기'>닫기</button>
        </header>
        <div className='min-h-0 flex-1'>
          <PersonalReadingVaultPanel mode={mode} />
        </div>
      </div>
    </div>
  );
}
