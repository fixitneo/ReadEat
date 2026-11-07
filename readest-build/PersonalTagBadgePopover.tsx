'use client';
import { usePersonalT } from '@/utils/personalI18n';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { eventDispatcher } from '@/utils/event';
import { useReaderStore } from '@/store/readerStore';

interface Preview { bookKey: string; noteId: string; tags: string[]; x: number; y: number }
export const PersonalTagBadgePopover: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const t = usePersonalT();
  const [preview, setPreview] = useState<Preview | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onOpen = (e: CustomEvent) => {
      const d = e.detail as Preview | null;
      if (d?.bookKey !== bookKey || !Array.isArray(d.tags) || !d.tags.length) return;
      setPreview((old) => old?.noteId === d.noteId ? null : d);
    };
    eventDispatcher.on('personal-tag-badge-open', onOpen);
    return () => eventDispatcher.off('personal-tag-badge-open', onOpen);
  }, [bookKey]);
  useEffect(() => {
    if (!preview) return;
    const closeOutside = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setPreview(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    // Capture clicks anywhere else without covering the reader.
    document.addEventListener('pointerdown', closeOutside, true);
    // EPUB pages live in their own iframes. Pointer events never bubble into
    // the parent document, so hook the visible document(s) as well.
    const frames = useReaderStore.getState().getView(bookKey)?.renderer.getContents() ?? [];
    const docs = frames.map((frame) => frame.doc).filter((doc): doc is Document => !!doc);
    for (const doc of docs) doc.addEventListener('pointerdown', closeOutside, true);
    const onFrameMessage = (event: MessageEvent) => {
      if (event.data?.bookKey === bookKey && event.data?.type === 'iframe-single-click')
        setPreview(null);
    };
    window.addEventListener('message', onFrameMessage);
    document.addEventListener('keydown', onKey);
    const closeOnMove = () => setPreview(null);
    window.addEventListener('resize', closeOnMove);
    window.addEventListener('scroll', closeOnMove, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      for (const doc of docs) doc.removeEventListener('pointerdown', closeOutside, true);
      window.removeEventListener('message', onFrameMessage);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closeOnMove);
      window.removeEventListener('scroll', closeOnMove, true);
    };
  }, [preview, bookKey]);
  if (!preview || typeof document === 'undefined') return null;
  const left = Math.max(8, Math.min(preview.x, window.innerWidth - 210));
  const top = Math.max(8, Math.min(preview.y + 12, window.innerHeight - 140));
  return createPortal(
    <div ref={panelRef} data-personal-tag-popover role='dialog' aria-label={t("Highlight tags")}
      className='fixed z-[160] max-w-[min(260px,calc(100vw-16px))] rounded-xl border border-base-content/15 bg-base-100 px-3 py-2 text-base-content shadow-2xl'
      style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      <div className='mb-1 text-xs font-semibold opacity-65'>{t("# Highlight tags")}</div>
      <div className='flex flex-wrap gap-1'>
        {preview.tags.map((tag) => <span key={tag} className='badge badge-outline badge-sm'>#{tag}</span>)}
      </div>
    </div>,
    document.body,
  );
};
