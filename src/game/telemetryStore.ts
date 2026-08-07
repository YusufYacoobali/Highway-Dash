import { create } from 'zustand';

import {
  EMPTY_TELEMETRY,
  type LaneCount,
  type RunEventId,
  type Telemetry,
  type WorldThemeId,
} from '@/engine/types';

interface TelemetryStore extends Telemetry {
  apply(snapshot: Telemetry): void;
  reset(): void;
}

/** HUD-facing mirror of the simulation, sampled at 15 Hz by the engine. */
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
export const useNitroActive = (): boolean => useTelemetryStore((s) => s.nitroActive);
export const useNitroRemaining = (): number => useTelemetryStore((s) => s.nitroRemaining);
export const useNitroGraceActive = (): boolean => useTelemetryStore((s) => s.nitroGraceActive);
export const useNitroGraceRemaining = (): number => useTelemetryStore((s) => s.nitroGraceRemaining);
export const useNitroSmashes = (): number => useTelemetryStore((s) => s.nitroSmashes);
export const useRunEvent = (): RunEventId => useTelemetryStore((s) => s.event);
export const useRunEventVariant = (): number => useTelemetryStore((s) => s.eventVariant);
export const useRunEventRemaining = (): number => useTelemetryStore((s) => s.eventRemaining);
export const useWorldTheme = (): WorldThemeId => useTelemetryStore((s) => s.theme);
export const useRunIntensity = (): number => useTelemetryStore((s) => s.intensity);
export const useLaneCount = (): LaneCount => useTelemetryStore((s) => s.laneCount);
