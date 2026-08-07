import { create } from 'zustand';

import { RunSummary } from './profileStore';

interface RunSessionState {
  /** Result of the most recent finished run, consumed by the crash screen. */
  summary: RunSummary | null;
  /** Bumped every time the player starts a run; the engine watches it to reset. */
  runToken: number;
  setSummary(summary: RunSummary): void;
  beginRun(): void;
  clear(): void;
}

/** Deliberately not persisted — a run summary is meaningless after a restart. */
export const useRunStore = create<RunSessionState>((set, get) => ({
  summary: null,
  runToken: 0,
  setSummary: (summary) => set({ summary }),
  beginRun: () => set({ runToken: get().runToken + 1, summary: null }),
  clear: () => set({ summary: null }),
}));
