import { useEffect, useRef, useState } from 'react';
import type { Book } from '@/types/book';
import { createPortal } from 'react-dom';
import { MdArrowDropDown, MdDragHandle, MdClose } from 'react-icons/md';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ShelfStatus } from '@/utils/personalShelfStatuses';
import {
  catalogItems, persistStatusCatalog, reorderStatuses, usePersonalStatusCatalog,
} from '@/utils/personalShelfStatuses';

function SortableEntry({
  entry, active, onChoose, onDelete,
}: {
  entry: ShelfStatus;
  active: boolean;
  onChoose: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: entry.id});
  return <div ref={setNodeRef}
      style={{transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition, zIndex: isDragging ? 1 : undefined}}
      className={'flex min-h-11 items-center gap-1 rounded-xl px-1 ' +
        (isDragging ? 'bg-base-300 shadow-lg ' : '') + (active ? 'bg-base-300/80' : 'hover:bg-base-300/50')}>
    <button type='button' role='menuitemradio' aria-checked={active}
      onClick={() => onChoose(entry.id)}
      className='flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-sm'>
      <span className='w-4 shrink-0 font-bold'>{active ? '✓' : ''}</span>
      <span className='truncate'>{entry.label}</span>
    </button>
    {!entry.required && <button type='button' title={'상태 삭제: ' + entry.label}
        aria-label={'상태 삭제: ' + entry.label}
        className='flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-base-content/60'
        onClick={() => void onDelete(entry.id)}><MdClose size={17}/></button>}
    <button type='button' {...attributes} {...listeners}
      title={'순서 이동: ' + entry.label} aria-label={'순서 이동: ' + entry.label}
      className='touch-none flex h-10 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-base-content/65 active:cursor-grabbing'>
      <MdDragHandle size={22}/>
    </button>
  </div>;
}

export default function PersonalShelfDropdown({
  value, books, onChange, onDeleteStatus,
}: {
  value: string;
  books: Book[];
  onChange: (status: string) => void;
  onDeleteStatus: (status: string) => void | Promise<void>;
}) {
  const catalog = usePersonalStatusCatalog(books);
  const anchor = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState({top: 0, left: 0, width: 240});
  const options = catalogItems(catalog);
  const current = options.find(option => option.id === value) ?? options[0]!;
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 6}}),
    useSensor(TouchSensor, {activationConstraint: {delay: 180, tolerance: 6}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
  );

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const button = anchor.current;
      if (!button) return;
      const box = button.getBoundingClientRect();
      const width = Math.min(300, Math.max(232, window.innerWidth - 24));
      setRect({
        top: Math.max(8, Math.min(box.bottom + 6, window.innerHeight - 88)),
        left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
        width,
      });
    };
    const outsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) &&
          !anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const escapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); setOpen(false); anchor.current?.focus();}
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', outsideClick);
    document.addEventListener('keydown', escapeKey);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', outsideClick);
      document.removeEventListener('keydown', escapeKey);
    };
  }, [open]);

  const handleEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const next = reorderStatuses(catalog, String(event.active.id), String(event.over.id));
    persistStatusCatalog(next);
  };

  return <>
    <button ref={anchor} type='button' aria-expanded={open} aria-haspopup='menu'
      aria-label='책장 상태 및 필터 선택'
      onClick={() => setOpen(!open)}
      className='inline-flex min-h-8 max-w-full items-center justify-start gap-1 rounded-lg px-0.5 text-left text-sm font-semibold hover:bg-base-200'>
      <span className='truncate'>{current.label}</span>
      <MdArrowDropDown className={'size-5 shrink-0 transition-transform ' + (open ? 'rotate-180' : '')}/>
    </button>
    {open && typeof document !== 'undefined' && createPortal(
      <div ref={menuRef} role='menu' aria-label='책장 상태 필터와 순서'
        className='bg-base-200 border-base-content/15 fixed z-[9999] rounded-2xl border p-2 shadow-2xl'
        style={{top: rect.top, left: rect.left, width: rect.width, maxHeight: 'min(68vh, 480px)', overflowY: 'auto'}}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
          <SortableContext items={options.map(option => option.id)} strategy={verticalListSortingStrategy}>
            {options.map(option => <SortableEntry key={option.id} entry={option}
              active={value === option.id}
              onChoose={id => {onChange(id); setOpen(false);}}
              onDelete={async id => {
                if (!window.confirm('이 상태를 삭제하고 책에 붙은 해당 상태도 해제할까요?')) return;
                await onDeleteStatus(id);
              }} />)}
          </SortableContext>
        </DndContext>
      </div>, document.body)}
  </>;
}
