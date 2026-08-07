import { create } from 'zustand';

import type { RunEventId } from '@/engine/types';
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

export function pushNearMissPop(combo: number, _stars: number): void {
  const { text, size } = praiseForCombo(combo);
  const color = combo >= 10 ? palette.cyanIce : palette.gold;
  usePopStore.getState().push(text, color, size);
}

export function pushRamPop(combo: number): void {
  const { push } = usePopStore.getState();
  push(combo >= 10 ? 'DELETED! +COMBO' : 'WRECKED!', palette.redHot, combo >= 10 ? 36 : 32);
}

export function pushWantedPop(stars: number): void {
  const { push } = usePopStore.getState();
  push(stars >= 5 ? 'MAX HEAT!' : `WANTED ${stars}★`, palette.redHot, stars >= 4 ? 34 : 28);
}

export function pushNewBestPop(): void {
  usePopStore.getState().push('NEW BEST! KEEP GOING!', palette.greenSoft, 36);
}

export function pushEventPop(event: RunEventId): void {
  const { push } = usePopStore.getState();
  const callout: Record<RunEventId, { text: string; color: string; size: number }> = {
    cruise: { text: 'BREATHE...', color: palette.white, size: 24 },
    coinRush: { text: 'COIN RUSH!', color: palette.gold, size: 34 },
    construction: { text: 'LANES CLOSING!', color: palette.gold, size: 32 },
    tunnel: { text: 'INTO THE TUNNEL!', color: palette.cyanIce, size: 32 },
    nitroRush: { text: 'NITRO FRENZY!', color: palette.cyanIce, size: 36 },
    police: { text: 'COPS ON YOU!', color: palette.redHot, size: 36 },
    roadblock: { text: 'ROADBLOCK!', color: palette.redHot, size: 38 },
  };
  const item = callout[event];
  push(item.text, item.color, item.size);
}
