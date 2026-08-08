import { create } from 'zustand';

import type { GateKind, RunEventId } from '@/engine/types';
import { palette } from '@/ui/theme';

export interface Pop {
  id: number;
  text: string;
  color: string;
  size: number;
  /** Percentage across the screen, keeps pops off the HUD chrome. */
  x: number;
  y: number;
}

interface PopStore {
  pops: Pop[];
  push(text: string, color: string, size: number): void;
  remove(id: number): void;
  clear(): void;
}

const MAX_VISIBLE = 5;
let nextId = 0;

export const usePopStore = create<PopStore>((set) => ({
  pops: [],
  push: (text, color, size) =>
    set((state) => ({
      pops: [
        ...state.pops,
        { id: ++nextId, text, color, size, x: 31 + Math.random() * 38, y: 235 + Math.random() * 92 },
      ].slice(-MAX_VISIBLE),
    })),
  remove: (id) => set((state) => ({ pops: state.pops.filter((pop) => pop.id !== id) })),
  clear: () => set({ pops: [] }),
}));

/** Escalating praise so a long chain visibly changes gear. */
export function praiseForCombo(combo: number): { text: string; size: number } {
  if (combo >= 20) return { text: 'ABSOLUTE CINEMA!', size: 38 };
  if (combo >= 15) return { text: 'YOU ARE NOT REAL!', size: 36 };
  if (combo >= 10) return { text: 'UNHINGED!', size: 35 };
  if (combo >= 6) return { text: 'INSANE!', size: 34 };
  if (combo >= 3) return { text: 'SO CLOSE!', size: 29 };
  return { text: 'CLOSE ONE!', size: 27 };
}

export function pushNearMissPop(combo: number): void {
  const { text, size } = praiseForCombo(combo);
  const color = combo >= 10 ? palette.cyanIce : palette.gold;
  usePopStore.getState().push(text, color, size);
}

export function pushRamPop(smashCount: number, grace: boolean): void {
  const { push } = usePopStore.getState();
  if (grace) {
    push('SAVED BY SHIELD!', palette.greenSoft, 30);
    return;
  }

  if (smashCount >= 7) push(`MASS DELETION x${smashCount}!`, palette.redHot, 40);
  else if (smashCount >= 4) push(`YEET CHAIN x${smashCount}!`, palette.redHot, 37);
  else if (smashCount >= 2) push(`SMASH x${smashCount}!`, palette.cyanIce, 34);
  else push('GET OUT THE WAY!', palette.cyanIce, 32);
}

export function pushShookOffPop(): void {
  usePopStore.getState().push('SHOOK THEM OFF!', palette.greenSoft, 36);
}

export function pushWantedPop(stars: number): void {
  const { push } = usePopStore.getState();
  push(stars >= 5 ? 'MAX HEAT!' : `WANTED ${stars}★`, palette.redHot, stars >= 4 ? 34 : 28);
}

export function pushNewBestPop(): void {
  usePopStore.getState().push('NEW BEST! KEEP GOING!', palette.greenSoft, 36);
}

/** A scrape is survivable, so the callout sells the cost, not the disaster. */
export function pushSideswipePop(multiplier: number): void {
  const { push } = usePopStore.getState();
  if (multiplier > 2) push(`SCRAPED! CHAIN DOWN TO x${multiplier.toFixed(1)}`, palette.orange, 31);
  else push('SCRAPED! PAINT DAMAGE', palette.orange, 29);
}

export function pushDraftPop(chain: number): void {
  const { push } = usePopStore.getState();
  if (chain >= 6) push(`SLIPSTREAM x${chain}! GLUED ON!`, palette.cyanIce, 34);
  else if (chain >= 3) push(`SLIPSTREAM x${chain}!`, palette.cyanIce, 32);
  else push('SLIPSTREAM! TUCK IN!', palette.cyanIce, 30);
}

export function pushGatePop(risky: boolean, kind: GateKind): void {
  const { push } = usePopStore.getState();
  if (!risky) {
    push('PLAYED IT SAFE', palette.greenSoft, 27);
    return;
  }
  if (kind === 'drift') push('DRIFT MODE! HOLD ON!', '#C45CFF', 37);
  else push('DOUBLE OR NOTHING!', palette.gold, 37);
}

/**
 * Only the events the player has to *do* something about get a callout. Coin
 * runs, tunnels and boost windows announce themselves perfectly well by being
 * visible through the windscreen.
 */
const EVENT_WARNINGS: Partial<Record<RunEventId, { text: string; color: string; size: number }>> = {
  police: { text: 'COPS ON YOU!', color: palette.redHot, size: 36 },
  roadblock: { text: 'ROADBLOCK!', color: palette.redHot, size: 38 },
  laneSqueeze: { text: 'ROAD NARROWS!', color: palette.orange, size: 34 },
};

export function isEventWarning(event: RunEventId): boolean {
  return EVENT_WARNINGS[event] !== undefined;
}

export function pushEventPop(event: RunEventId): void {
  const item = EVENT_WARNINGS[event];
  if (!item) return;
  usePopStore.getState().push(item.text, item.color, item.size);
}
