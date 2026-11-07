'use client';
import { usePersonalT } from '@/utils/personalI18n';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { IoIosList } from 'react-icons/io';
import { PiSun, PiNotePencil } from 'react-icons/pi';
import { RxSlider } from 'react-icons/rx';
import { RiFontFamily, RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';
import { MdOutlineHeadphones, MdOutlineBookmarkBorder, MdOutlineSearch, MdOutlineSettings, MdOutlineTranslate, MdOutlineViewAgenda, MdOutlineMenuBook, MdOutlineTune } from 'react-icons/md';
import { useSettingsStore } from '@/store/settingsStore';
import { useReaderStore } from '@/store/readerStore';
import { eventDispatcher } from '@/utils/event';
import {
  ACTIONS,
  normalizePersonalConfig, getPersonalLayout, currentFoldMode,
  type FoldMode, type PersonalAction,
} from '@/utils/personalControlsConfig';

interface Props {
  bookKey: string;
  actionTab: string;
  onSetActionTab: (tab: string) => void;
}

const icons: Partial<Record<PersonalAction, React.ReactNode>> = {
  'page-prev': <RiArrowLeftSLine />,
  'page-next': <RiArrowRightSLine />,
  'section-prev': <span aria-hidden='true'>«</span>,
  'section-next': <span aria-hidden='true'>»</span>,
  'toc': <IoIosList />,
  'color': <PiSun />,
  'progress': <RxSlider />,
  'font': <RiFontFamily />,
  'tts': <MdOutlineHeadphones />,
  'bookmark': <MdOutlineBookmarkBorder />,
  'bookmarks': <MdOutlineViewAgenda />,
  'annotations': <PiNotePencil />,
  'notes': <PiNotePencil />,
  'search': <MdOutlineSearch />,
  'settings': <MdOutlineSettings />,
  'customize': <MdOutlineTune />,
  'translation': <MdOutlineTranslate />,
  'single-page': <MdOutlineMenuBook />,
  'two-page': <span aria-hidden='true' className='text-sm font-semibold'>2</span>,
  'toggle-bars': <IoIosList />,
};

const nativeTabs: Partial<Record<PersonalAction, string>> = {
  'toc': 'toc',
  'color': 'color',
  'progress': 'progress',
  'font': 'font',
  'tts': 'tts',
  'annotations': 'note',
};

export const PersonalFooterBar: React.FC<Props> = ({ bookKey, actionTab, onSetActionTab }) => {
  const t = usePersonalT();
  const raw = useSettingsStore((s) => s.settings.personalControls);
  const config = normalizePersonalConfig(raw);
  const [foldMode, setFoldMode] = useState<FoldMode>(() => currentFoldMode());
  useEffect(() => {
    const update = () => setFoldMode(currentFoldMode());
    window.addEventListener('resize', update);
    window.screen.orientation?.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.screen.orientation?.removeEventListener('change', update);
    };
  }, []);
  const layout = getPersonalLayout(config, foldMode);
  const bookKeys = useReaderStore((s) => s.bookKeys);
  if (!bookKeys.includes(bookKey)) return null;
  const run = (action: PersonalAction) => {
    if (action === 'customize') {
      void eventDispatcher.dispatch('personal-controls-edit', { bookKey });
      return;
    }
    const nativeTab = nativeTabs[action];
    if (nativeTab) {
      onSetActionTab(nativeTab);
      return;
    }
    void eventDispatcher.dispatch('personal-control-action', { action, bookKey });
  };
  return (
    <div
      className='no-scrollbar flex min-w-0 w-full items-center justify-between gap-1 overflow-x-auto'
      aria-label={t("Customizable reading actions")}
      onContextMenu={(e) => {
        e.preventDefault();
        void eventDispatcher.dispatch('personal-controls-edit', { bookKey });
      }}
    >
      {layout.toolbar.map((action, index) => {
        const tab = nativeTabs[action];
        const selected = !!tab && actionTab === tab;
        const label = t(ACTIONS.find((entry) => entry.id === action)?.label ?? action);
        return (
          <button
            type='button'
            key={index}
            aria-label={label}
            title={label}
            data-personal-action={action}
            onClick={() => run(action)}
            className={clsx(
              'flex h-11 min-w-11 shrink-0 flex-1 items-center justify-center rounded-xl text-[23px] transition-colors duration-150 active:scale-95',
              selected ? 'bg-primary/15 text-primary' : 'text-base-content active:bg-base-300/80',
            )}
          >
            {icons[action] ?? <span>{label.slice(0, 1)}</span>}
          </button>
        );
      })}
      {layout.toolbar.length === 0 && (
        <button
          type='button'
          className='mx-auto h-11 px-4 text-sm'
          onClick={() => void eventDispatcher.dispatch('personal-controls-edit', { bookKey })}
        >
          {t("Customize reading toolbar")}
        </button>
      )}
    </div>
  );
};
