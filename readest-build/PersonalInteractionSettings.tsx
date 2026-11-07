'use client';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomDictionaryStore } from '@/store/customDictionaryStore';
import { getEnabledProviders } from '@/services/dictionaries/registry';
import { saveViewSettings } from '@/helpers/settings';
import type { ViewSettings } from '@/types/book';
import { normalizePageMotion } from '@/utils/personalInteraction';
import { eventDispatcher } from '@/utils/event';
import { BoxedList, SettingsRow, SettingsSelect, Tips } from './primitives';

export default function PersonalInteractionSettings({ bookKey }: { bookKey: string }) {
  const { envConfig, appService } = useEnv();
  const settings = useSettingsStore((s) => s.settings);
  const view = useReaderStore((s) => s.getViewSettings(bookKey)) ?? settings.globalViewSettings;
  const dict = useCustomDictionaryStore();
  const motion = normalizePageMotion(view);
  const providers = getEnabledProviders({
    settings: dict.settings,
    dictionaries: dict.dictionaries,
    fs: appService ?? undefined,
  });
  const options = [
    { value: 'default', label: '기존 사전 설정' },
    { value: 'system', label: '설치된 사전·번역 앱' },
    { value: 'google-translate', label: 'Google 번역' },
    ...providers.map((p) => ({ value: p.id, label: p.label })),
  ];
  const languages = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'zh-CN', label: '简体中文' },
    { value: 'zh-TW', label: '繁體中文' },
    { value: 'de', label: 'Deutsch' },
    { value: 'fr', label: 'Français' },
    { value: 'es', label: 'Español' },
  ];
  const save = <K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) => {
    void saveViewSettings(envConfig, bookKey, key, value, false, false).catch((error) =>
      eventDispatcher.dispatch('toast', { type: 'error', message: String(error), timeout: 4000 }),
    );
  };
  return (
    <>
      <BoxedList title='종이 넘김 · WebGL'>
        <SettingsRow label='페이지 곡률'>
          <SettingsSelect
            value={motion.preset}
            ariaLabel='페이지 곡률'
            options={[
              { value: 'apple', label: '부드러운 곡면' },
              { value: 'google', label: '모서리 접기' },
            ]}
            onChange={(e) =>
              save('personalPageCurl', e.target.value === 'google' ? 'google' : 'apple')
            }
          />
        </SettingsRow>
        <SettingsRow label={'넘김 시간 · ' + motion.duration + 'ms'}>
          <input
            className='range range-xs w-36'
            aria-label='페이지 넘김 시간'
            type='range'
            min={150}
            max={1000}
            step={25}
            value={motion.duration}
            onChange={(e) => save('personalPageTurnMs', Number(e.target.value))}
          />
        </SettingsRow>
        <Tips>
          애니메이션 스타일에서 Page Curl을 선택하세요. 손가락으로 드래그하고 되돌릴 수 있습니다.
          전자잉크·스크롤 모드에서는 기존 동작을 따릅니다.
        </Tips>
      </BoxedList>
      <BoxedList title='사전 버튼 · 누르기 / 길게 누르기'>
        <SettingsRow label='사전 1 · 누르기'>
          <SettingsSelect
            value={view.personalDictionary1 ?? 'default'}
            ariaLabel='사전 1'
            options={options}
            onChange={(e) => save('personalDictionary1', e.target.value)}
          />
        </SettingsRow>
        <SettingsRow label='사전 2 · 길게 누르기'>
          <SettingsSelect
            value={view.personalDictionary2 ?? 'google-translate'}
            ariaLabel='사전 2'
            options={options}
            onChange={(e) => save('personalDictionary2', e.target.value)}
          />
        </SettingsRow>
        <SettingsRow label='Google 번역 · 원문 언어'>
          <SettingsSelect
            value={view.personalTranslationSource ?? 'auto'}
            ariaLabel='원문 언어'
            options={[{ value: 'auto', label: '자동 감지' }, ...languages]}
            onChange={(e) => save('personalTranslationSource', e.target.value)}
          />
        </SettingsRow>
        <SettingsRow label='Google 번역 · 번역 언어'>
          <SettingsSelect
            value={view.personalTranslationTarget ?? 'ko'}
            ariaLabel='번역 언어'
            options={languages}
            onChange={(e) => save('personalTranslationTarget', e.target.value)}
          />
        </SettingsRow>
        <Tips>
          설치 앱은 Android의 사전 선택기를 사용합니다. 앱이 없으면 앱 안 사전으로 돌아옵니다.
          Google 번역은 버튼을 누를 때만 선택 문구를 외부로 보냅니다. 사전 목록·가져오기는 기존 언어
          설정에서 관리합니다.
        </Tips>
      </BoxedList>
    </>
  );
}
