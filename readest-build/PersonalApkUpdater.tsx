'use client';
import React, { useState } from 'react';
import { RiArrowUpCircleLine, RiFileUploadLine, RiShieldCheckLine } from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useFileSelector } from '@/hooks/useFileSelector';
import { installPackage } from '@/utils/bridge';

type Status = 'idle' | 'checking' | 'ready' | 'error';
export default function PersonalApkUpdater() {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { selectFiles } = useFileSelector(appService, _);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  if (!appService?.isAndroidApp) return null;

  const chooseAndInstall = async () => {
    if (status === 'checking') return;
    setMessage('');
    setStatus('idle');
    try {
      const selected = await selectFiles({
        type: 'generic',
        accept: '.apk,application/vnd.android.package-archive',
        extensions: ['apk'],
        dialogTitle: 'Readest Personal 업데이트 APK 선택',
      });
      if (selected.error) throw new Error(selected.error);
      const chosen = selected.files[0];
      if (!chosen) return;
      if (!chosen.path) throw new Error('Android 저장소에서 APK 파일을 선택해 주세요.');
      setStatus('checking');
      const result = await installPackage({ path: chosen.path });
      if (!result.success) {
        throw new Error(result.error || '선택한 APK를 설치할 수 없습니다.');
      }
      // This only means the system installer was launched, not that the user
      // approved installation or that Android committed the update.
      setStatus('ready');
      setMessage('Android 설치 화면이 열렸습니다. ‘업데이트’ 또는 ‘설치’를 확인해 주세요. 기존 앱은 삭제하지 마세요.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section aria-label='Readest Personal APK 업데이트' className='rounded-2xl border border-base-content/15 bg-base-100/50 p-4'>
      <div className='flex items-center gap-2'>
        <RiArrowUpCircleLine className='h-6 w-6 shrink-0' />
        <div className='min-w-0'>
          <h3 className='text-base font-semibold'>앱 업데이트</h3>
          <p className='text-base-content/65 text-xs'>APK 파일을 선택하여 기존 데이터를 유지하면서 앱을 업데이트합니다.</p>
        </div>
      </div>
      <button type='button' className='btn btn-primary mt-4 w-full gap-2'
        onClick={() => void chooseAndInstall()} disabled={status === 'checking'}>
        <RiFileUploadLine />
        {status === 'checking' ? '패키지 · 서명 · 버전 확인 중…' : 'APK 선택하여 업데이트'}
      </button>
      <p className='text-base-content/65 mt-3 flex items-start gap-1.5 text-xs'>
        <RiShieldCheckLine className='mt-0.5 shrink-0' />
        같은 앱·같은 서명·더 높은 버전만 허용합니다. 확인 없이 앱을 삭제하거나 데이터를 초기화하지 않습니다.
      </p>
      {message && <p role='status' className={'mt-3 rounded-lg border p-3 text-xs ' +
        (status === 'error' ? 'border-error/40 text-error' : 'border-base-content/20')}>
        {message}
      </p>}
    </section>
  );
}
