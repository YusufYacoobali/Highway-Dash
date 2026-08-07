import { create } from 'zustand';

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

const MAX_VISIBLE = 4;
let nextId = 0;

/** Short-lived praise text ("SO CLOSE!") thrown up on near-misses. */
export const usePopStore = create<PopStore>((set) => ({
  pops: [],
  push: (text, color, size) =>
    set((state) => ({
      pops: [
        ...state.pops,
        { id: ++nextId, text, color, size, x: 34 + Math.random() * 32, y: 250 + Math.random() * 60 },
      ].slice(-MAX_VISIBLE),
    })),
  remove: (id) => set((state) => ({ pops: state.pops.filter((pop) => pop.id !== id) })),
  clear: () => set({ pops: [] }),
}));

/** Escalating praise so a long chain of near-misses keeps feeling rewarded. */
export function praiseForCombo(combo: number): { text: string; size: number } {
  if (combo > 9) return { text: 'UNREAL!', size: 34 };
  if (combo > 5) return { text: 'INSANE!', size: 34 };
  if (combo > 2) return { text: 'SO CLOSE!', size: 28 };
  return { text: 'CLOSE ONE!', size: 28 };
}

export function pushNearMissPop(combo: number, stars: number): void {
  const { text, size } = praiseForCombo(combo);
  const { push } = usePopStore.getState();
  push(text, palette.gold, size);
  if (stars > 0 && combo % 4 === 0) push('WANTED +1', palette.redHot, 25);
}
