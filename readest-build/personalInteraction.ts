export function normalizePageMotion(value: {
  personalPageTurnMs?: unknown;
  personalPageCurl?: unknown;
}) {
  const ms = Number(value.personalPageTurnMs);
  const preset = value.personalPageCurl === 'google' ? 'google' : 'apple';
  return {
    preset,
    duration: Number.isFinite(ms) ? Math.round(Math.max(150, Math.min(1000, ms))) : 450,
    radius: preset === 'google' ? 0.075 : 0.16,
    tilt: preset === 'google' ? 2.5 : 1.8,
  } as const;
}
export function preferDictionary<T extends { id: string }>(
  providers: T[],
  preferred?: string,
): T[] {
  const first = providers.find((p) => p.id === preferred);
  return first ? [first, ...providers.filter((p) => p !== first)] : providers;
}
export function makeTranslationUrl(text: string, source = 'auto', target = 'ko'): string {
  const language = (value: string, fallback: string) =>
    /^(auto|[a-z]{2,3}(-[A-Za-z]{2,8})?)$/.test(value) ? value : fallback;
  return (
    'https://translate.google.com/?' +
    new URLSearchParams({
      sl: language(source, 'auto'),
      tl: language(target, 'ko'),
      text,
      op: 'translate',
    })
  );
}
