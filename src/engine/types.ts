import type { Group, Scene } from 'three';

import type { RunResult } from '@/domain/runResult';
import type { RunTuning } from '@/domain/tuning';
import type { VehicleSilhouette } from '@/domain/cars';

/** `attract` is the idle traffic loop that plays behind the main menu. */
export type EngineMode = 'attract' | 'run';

export type RunEventId =
  | 'cruise'
  | 'coinRush'
  | 'construction'
  | 'tunnel'
  | 'nitroRush'
  | 'police'
  | 'roadblock'
  | 'laneSqueeze';

export type WorldThemeId =
  | 'sunset'
  | 'forest'
  | 'tunnel'
  | 'night'
  | 'coast'
  | 'storm'
  | 'desert'
  | 'snow'
  | 'neon'
  | 'volcano';

export type LaneCount = 3 | 4;

/**
 * What the risky half of a gate is offering. `double` is straight score;
 * `drift` pays more but swaps in heavy, momentum-carrying steering for the
 * duration — the bargain the player is actually being asked to weigh.
 */
export type GateKind = 'double' | 'drift';

export interface Telemetry {
  kmh: number;
  /** Metres. The HUD renders it as kilometres. */
  distance: number;
  /** The headline number: metres banked at the multiplier that was live. */
  score: number;
  /** Live risk multiplier, 1 when the chain is cold. */
  multiplier: number;
  /** 0–1 of the chain window still on the clock; drives the drain bar. */
  chainRemaining: number;
  coins: number;
  combo: number;
  stars: number;
  /** Free hits left this run. */
  /** 0–1 progress of the police towards a PIT manoeuvre at max heat. */
  bustThreat: number;
  /** 0–1 how close the nearest interceptor is — drives the siren wash. */
  policeProximity: number;
  driftMode: boolean;
  /** 0–1 charge on the slipstream meter. */
  draftCharge: number;
  drafting: boolean;
  gateApproaching: boolean;
  gateRiskSide: number;
  gateKind: GateKind;
  gateBoostRemaining: number;
  /** Which half of the road the car is on right now: -1 left, 1 right. */
  playerSide: number;
  started: boolean;
  nitroActive: boolean;
  nitroReady: boolean;
  nitroRemaining: number;
  nitroGraceActive: boolean;
  nitroGraceRemaining: number;
  nitroSmashes: number;
  event: RunEventId;
  /** 0–3 flavour chosen fresh whenever an event starts. */
  eventVariant: number;
  eventRemaining: number;
  theme: WorldThemeId;
  intensity: number;
  laneCount: LaneCount;
}

export const EMPTY_TELEMETRY: Telemetry = {
  kmh: 0,
  distance: 0,
  score: 0,
  multiplier: 1,
  chainRemaining: 0,
  coins: 0,
  combo: 0,
  stars: 0,
  bustThreat: 0,
  policeProximity: 0,
  driftMode: false,
  draftCharge: 0,
  drafting: false,
  gateApproaching: false,
  gateRiskSide: 0,
  gateKind: 'double',
  gateBoostRemaining: 0,
  playerSide: 1,
  started: false,
  nitroActive: false,
  nitroReady: true,
  nitroRemaining: 0,
  nitroGraceActive: false,
  nitroGraceRemaining: 0,
  nitroSmashes: 0,
  event: 'cruise',
  eventVariant: 0,
  eventRemaining: 0,
  theme: 'sunset',
  intensity: 0,
  laneCount: 4,
};

export interface EngineEvents {
  telemetry: Telemetry;
  /** `closeCall` marks the passes tight enough to earn a slow-mo beat. */
  nearMiss: { combo: number; stars: number; closeCall: boolean; gap: number };
  coinCollected: { total: number };
  starGained: { stars: number };
  /** Boosted clear of a closing PIT — the pursuit is broken. */
  shookOff: { stars: number };
  nitroFired: Record<string, never>;
  trafficRammed: { combo: number; smashCount: number; grace: boolean };
  /** A survivable graze along the flank. `severity` is 0–1 overlap depth. */
  sideswiped: { severity: number; multiplier: number };
  /** A slipstream charge completed behind a traffic car. */
  drafted: { chain: number; multiplier: number };
  /** A risk gate has spawned; `riskSide` is -1 for left, 1 for right. */
  gateApproaching: { riskSide: number; kind: GateKind };
  /** The player committed to one side of a risk gate. */
  gateChosen: { risky: boolean; kind: GateKind; multiplier: number };
  eventStarted: { event: RunEventId; theme: WorldThemeId };
  themeChanged: { theme: WorldThemeId };
  crashed: RunResult;
}

export interface RunState {
  mode: EngineMode;
  elapsed: number;
  speed: number;
  steerTarget: number;
  x: number;
  /** Lateral velocity of the car in m/s — the state that gives it mass. */
  steerVelocity: number;
  distance: number;
  score: number;
  multiplier: number;
  bestMultiplier: number;
  coins: number;
  combo: number;
  bestCombo: number;
  comboTimer: number;
  nearMisses: number;
  sideswipes: number;
  stars: number;
  starProgress: number;
  wantedPeak: number;
  secondsSinceNearMiss: number;
  secondsAtMaxStars: number;
  /** 0–1 progress of the police closing for a PIT at max heat. */
  bustThreat: number;
  /** 0–1 how much of the mirror the nearest interceptor is filling. */
  policeProximity: number;
  contactImmunityRemaining: number;
  /** Seconds of heavy, momentum-carrying steering left from a drift gate. */
  driftModeRemaining: number;
  /* --- Drafting --- */
  drafting: boolean;
  draftCharge: number;
  draftSurgeRemaining: number;
  drafts: number;
  /* --- Risk gate --- */
  gateApproaching: boolean;
  /** -1 when the left arch is the risky one, 1 when it is the right, 0 none. */
  gateRiskSide: number;
  gateKind: GateKind;
  gateBoostRemaining: number;
  gatesTaken: number;
  /* --- Feel --- */
  cameraNudge: number;
  nearMissFlashRemaining: number;
  topSpeedKmh: number;
  nitroRemaining: number;
  nitroCooldown: number;
  nitroGraceRemaining: number;
  nitroSmashes: number;
  started: boolean;
  crashed: boolean;
  cameraShake: number;
  slowMoRemaining: number;
  slowMoScale: number;
  /** Gates the near-miss slow-mo so dense traffic cannot strobe it. */
  slowMoCooldown: number;
  event: RunEventId;
  eventVariant: number;
  eventRemaining: number;
  eventSerial: number;
  theme: WorldThemeId;
  intensity: number;
  trafficIntensity: number;
  policePressure: number;
  laneCount: LaneCount;
}

export interface SystemContext {
  scene: Scene;
  state: RunState;
  tuning: RunTuning;
  player: VehicleObject;
  dt: number;
  scroll: number;
}

export interface GameSystem {
  readonly name: string;
  update(ctx: SystemContext): void;
  reset?(ctx: Omit<SystemContext, 'dt' | 'scroll'>): void;
  dispose?(): void;
}

export interface Livery {
  body: string;
  roof: string;
}

export interface VehicleMeta {
  length: number;
  width: number;
  silhouette: VehicleSilhouette;
  livery: Livery;
  modelId?: string;
  speed: number;
  passed: boolean;
  /** Lane centre this car is driving; flinch drift is applied on top. */
  laneX?: number;
  driftVelocityX?: number;
  /** Already scraped the player — cannot graze the same car twice. */
  scraped?: boolean;
  rammed?: boolean;
  ramVelocityX?: number;
  ramVelocityY?: number;
  ramVelocityZ?: number;
  ramSpin?: number;
}

export type VehicleObject = Group & { userData: VehicleMeta };

export interface VehicleBodySpec {
  silhouette: VehicleSilhouette;
  livery: Livery;
  modelId?: string;
  recolor: boolean;
}

export interface VehicleBodyProvider {
  readonly id: string;
  readonly ownsGpuResources: boolean;
  build(spec: VehicleBodySpec): Group;
  dimensions(silhouette: VehicleSilhouette, modelId?: string): { length: number; width: number };
}
