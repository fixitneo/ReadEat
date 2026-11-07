import { describe, expect, it } from 'vitest';
import { PERSONAL_KO, personalTranslate } from '@/utils/personalI18n';

describe('Readest Personal UI language', () => {
  it('uses Korean for system Korean and regional Korean locales', () => {
    expect(personalTranslate('Custom tap layout', 'ko-KR')).toBe('사용자 지정 터치 배치');
    expect(personalTranslate('Annotation tags', 'ko')).toBe('주석 태그');
    expect(personalTranslate('PDF options', 'ko-KR')).toBe('PDF 옵션');
    expect(personalTranslate('Page turn sounds', 'ko-KR')).toBe('페이지 넘김 소리');
  });
  it('keeps stable internal values and falls back safely in other languages', () => {
    expect(personalTranslate('Custom tap layout', 'en-US')).toBe('Custom tap layout');
    expect(personalTranslate('Custom tap layout', 'ja-JP')).toBe('Custom tap layout');
    expect(personalTranslate('Unknown custom label', 'ko-KR')).toBe('Unknown custom label');
  });
  it('interpolates dynamic zone names without formatting ambiguities', () => {
    expect(personalTranslate('Zone {zone} → {action} ({mode})', 'ko-KR', {
      zone: 7, action: '이전 페이지', mode: '접힘',
    })).toBe('7번 영역 → 이전 페이지 (접힘)');
    expect(personalTranslate('Move action {number} down', 'ko-KR', {number: 3}))
      .toBe('3번 동작 아래로 이동');
  });
  it('uses Readest translation for other languages if available', () => {
    expect(personalTranslate('PDF options', 'fr-FR', undefined,
      key => key === 'PDF options' ? 'Options PDF' : key)).toBe('Options PDF');
  });
  it('ships translations for the important new controls', () => {
    for (const name of [
      'Readest default', 'Custom tap layout', 'PDF options', 'Annotation tags',
      'Page turn sounds', 'Book content CSS', 'Filter quick reading shelf',
      'Could not open the Android folder picker. Please try again.',
      'Toggle PDF text reading mode',
      'Select a supported audio file.',
      'Audio file exceeds 1 MB.',
      'Sound read failed',
    ]) expect(PERSONAL_KO[name]).toBeTruthy();
  });
});
