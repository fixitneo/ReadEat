import type { FoliateView } from '@/types/view';
const silencers = new Set<() => boolean>();
export function registerManualTurnSilencer(probe: () => boolean): () => void {
  silencers.add(probe);
  return () => {
    silencers.delete(probe);
  };
}
const isNarrating = () => [...silencers].some((probe) => probe());

export const PERSONAL_PAGE_COMMIT = 'readest-personal-page-commit';
let epoch = 0,
  listening = false;
const ensureLifecycle = () => {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('blur', () => {
    epoch++;
  });
  document.addEventListener('visibilitychange', () => {
    epoch++;
  });
};
export function manualTurnPosition(view: FoliateView): string | null {
  const renderer = view.renderer as typeof view.renderer & { index?: number };
  if (Number.isInteger(renderer.page) && Number.isInteger(renderer.primaryIndex))
    return String(renderer.primaryIndex) + ':' + String(renderer.page);
  if (Number.isInteger(renderer.index)) return String(renderer.index) + ':0';
  const detail = view.lastLocation as {
    location?: { current?: number };
    section?: { current?: number };
  };
  if (!Number.isInteger(detail?.location?.current)) return null;
  return String(detail?.section?.current ?? '?') + ':' + String(detail?.location?.current);
}
export type ManualTurnTicket = {
  position: string | null;
  consumed: boolean;
  epoch: number;
  silent: boolean;
  at: number;
};
export function beginManualTurn(view: FoliateView): ManualTurnTicket {
  ensureLifecycle();
  return {
    position: manualTurnPosition(view),
    consumed: false,
    epoch,
    at: Date.now(),
    silent: document.visibilityState !== 'visible' || isNarrating(),
  };
}
export function commitManualTurn(view: FoliateView, ticket: ManualTurnTicket): boolean {
  const after = manualTurnPosition(view);
  if (
    ticket.consumed ||
    ticket.silent ||
    ticket.epoch !== epoch ||
    ticket.position === null ||
    after === null ||
    ticket.position === after ||
    document.visibilityState !== 'visible' ||
    isNarrating()
  )
    return false;
  ticket.consumed = true;
  view.dispatchEvent(
    new CustomEvent(PERSONAL_PAGE_COMMIT, { detail: { before: ticket.position, after } }),
  );
  return true;
}
export async function runManualTurn(view: FoliateView, action: () => Promise<void>): Promise<void> {
  const ticket = beginManualTurn(view);
  await action();
  commitManualTurn(view, ticket);
}
