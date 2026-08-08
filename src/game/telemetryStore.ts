import { create } from 'zustand';

import {
  EMPTY_TELEMETRY,
  type GateKind,
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
export const useScore = (): number => useTelemetryStore((s) => s.score);
export const useMultiplier = (): number => useTelemetryStore((s) => s.multiplier);
export const useChainRemaining = (): number => useTelemetryStore((s) => s.chainRemaining);
export const useRunCoins = (): number => useTelemetryStore((s) => s.coins);
export const useCombo = (): number => useTelemetryStore((s) => s.combo);
export const useWantedStars = (): number => useTelemetryStore((s) => s.stars);
export const useBustThreat = (): number => useTelemetryStore((s) => s.bustThreat);
export const usePoliceProximity = (): number => useTelemetryStore((s) => s.policeProximity);
export const useDriftMode = (): boolean => useTelemetryStore((s) => s.driftMode);
export const useDraftCharge = (): number => useTelemetryStore((s) => s.draftCharge);
export const useDrafting = (): boolean => useTelemetryStore((s) => s.drafting);
export const useGateApproaching = (): boolean => useTelemetryStore((s) => s.gateApproaching);
export const useGateRiskSide = (): number => useTelemetryStore((s) => s.gateRiskSide);
export const useGateKind = (): GateKind => useTelemetryStore((s) => s.gateKind);
export const useGateBoost = (): number => useTelemetryStore((s) => s.gateBoostRemaining);
export const usePlayerSide = (): number => useTelemetryStore((s) => s.playerSide);
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
