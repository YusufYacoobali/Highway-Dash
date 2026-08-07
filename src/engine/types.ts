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

export interface Telemetry {
  kmh: number;
  distance: number;
  coins: number;
  combo: number;
  stars: number;
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
  coins: 0,
  combo: 0,
  stars: 0,
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
  nearMiss: { combo: number; stars: number };
  coinCollected: { total: number };
  starGained: { stars: number };
  nitroFired: Record<string, never>;
  trafficRammed: { combo: number; smashCount: number; grace: boolean };
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
  distance: number;
  coins: number;
  combo: number;
  bestCombo: number;
  comboTimer: number;
  nearMisses: number;
  stars: number;
  starProgress: number;
  wantedPeak: number;
  secondsSinceNearMiss: number;
  secondsAtMaxStars: number;
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
