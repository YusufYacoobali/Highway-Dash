import { create } from 'zustand';

import { EMPTY_TELEMETRY, type Telemetry } from '@/engine/types';

interface TelemetryStore extends Telemetry {
  apply(snapshot: Telemetry): void;
  reset(): void;
}

/**
 * HUD-facing mirror of the simulation. The engine pushes here at a fixed 15 Hz
 * and each HUD element subscribes to a single field, so a changing speed
 * readout never re-renders the coin counter.
 */
export const useTelemetryStore = create<TelemetryStore>((set) => ({
  ...EMPTY_TELEMETRY,
  apply: (snapshot) => set(snapshot),
  reset: () => set({ ...EMPTY_TELEMETRY }),
}));

export const useSpeed = (): number => useTelemetryStore((s) => s.kmh);
export const useDistance = (): number => useTelemetryStore((s) => s.distance);
export const useRunCoins = (): number => useTelemetryStore((s) => s.coins);
export const useCombo = (): number => useTelemetryStore((s) => s.combo);
export const useWantedStars = (): number => useTelemetryStore((s) => s.stars);
export const useHasStarted = (): boolean => useTelemetryStore((s) => s.started);
export const useNitroReady = (): boolean => useTelemetryStore((s) => s.nitroReady);
