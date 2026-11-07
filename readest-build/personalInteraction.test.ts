import { describe, expect, it } from 'vitest';
import {
  normalizePageMotion,
  preferDictionary,
  makeTranslationUrl,
} from '@/utils/personalInteraction';

describe('personal reference interactions', () => {
  it('bounds transition duration and gives the two curls different geometry', () => {
    expect(normalizePageMotion({ personalPageTurnMs: -10 }).duration).toBe(150);
    expect(normalizePageMotion({ personalPageTurnMs: 9000 }).duration).toBe(1000);
    expect(normalizePageMotion({ personalPageTurnMs: Number.NaN }).duration).toBe(450);
    const apple = normalizePageMotion({ personalPageCurl: 'apple' });
    const google = normalizePageMotion({ personalPageCurl: 'google' });
    expect(google.radius).toBeLessThan(apple.radius);
    expect(google.tilt).toBeGreaterThan(apple.tilt);
    expect(normalizePageMotion({ personalPageCurl: 'invalid' }).preset).toBe('apple');
  });
  it('keeps imported and enabled providers; only promotes the explicitly chosen one', () => {
    const providers = [{ id: 'builtin:a' }, { id: 'mdict:b' }, { id: 'web:c' }];
    expect(preferDictionary(providers, 'mdict:b').map((p) => p.id)).toEqual([
      'mdict:b',
      'builtin:a',
      'web:c',
    ]);
    expect(preferDictionary(providers, 'missing')).toEqual(providers);
    expect(providers.map((p) => p.id)).toEqual(['builtin:a', 'mdict:b', 'web:c']);
  });
  it('only makes a translation URL for explicit lookup and encodes the text', () => {
    const url = new URL(makeTranslationUrl('a&b 한글', 'auto', 'ko'));
    expect(url.origin).toBe('https://translate.google.com');
    expect(url.searchParams.get('text')).toBe('a&b 한글');
    expect(url.searchParams.get('sl')).toBe('auto');
    expect(url.searchParams.get('tl')).toBe('ko');
    expect(new URL(makeTranslationUrl('word', 'bad url', 'bad url')).searchParams.get('tl')).toBe(
      'ko',
    );
  });
});
