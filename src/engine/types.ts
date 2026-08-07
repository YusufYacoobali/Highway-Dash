import type { Group, Scene } from 'three';

import type { RunResult } from '@/domain/runResult';
import type { RunTuning } from '@/domain/tuning';
import type { VehicleSilhouette } from '@/domain/cars';

/** `attract` is the idle traffic loop that plays behind the main menu. */
export type EngineMode = 'attract' | 'run';

/** Snapshot pushed to the HUD. Plain data so it can cross the React boundary. */
export interface Telemetry {
  kmh: number;
  distance: number;
  coins: number;
  combo: number;
  stars: number;
  /** False until the player first touches the road — gates the tutorial hint. */
  started: boolean;
  nitroActive: boolean;
  nitroReady: boolean;
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
};

export interface EngineEvents {
  telemetry: Telemetry;
  nearMiss: { combo: number; stars: number };
  coinCollected: { total: number };
  starGained: { stars: number };
  nitroFired: Record<string, never>;
  crashed: RunResult;
}

/** Mutable per-run simulation state, owned by the engine and read by systems. */
export interface RunState {
  mode: EngineMode;
  elapsed: number;
  speed: number;
  /** Where the player is steering to; `x` chases it. */
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
  started: boolean;
  crashed: boolean;
  cameraShake: number;
}

/** Everything a system may touch during a frame. */
export interface SystemContext {
  scene: Scene;
  state: RunState;
  tuning: RunTuning;
  player: VehicleObject;
  dt: number;
  /** World-space metres the road scrolled this frame. */
  scroll: number;
}

export interface GameSystem {
  readonly name: string;
  update(ctx: SystemContext): void;
  /** Called whenever a fresh run (or attract loop) begins. */
  reset?(ctx: Omit<SystemContext, 'dt' | 'scroll'>): void;
  dispose?(): void;
}

/** Paint job applied on top of a shared silhouette. */
export interface Livery {
  body: string;
  roof: string;
}

export interface VehicleMeta {
  length: number;
  width: number;
  silhouette: VehicleSilhouette;
  livery: Livery;
  /** Active authored test GLB id, when the glTF provider is being used. */
  modelId?: string;
  /** Traffic only: how fast this car is cruising, world units/second. */
  speed: number;
  /** Traffic only: whether the near-miss check has already run for this car. */
  passed: boolean;
  /** Nitro collisions turn traffic into temporary launched physics props. */
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
  /** Optional authored GLB id used by the test model pool. */
  modelId?: string;
  /**
   * True for the player's car, whose paint may match the garage selection.
   * Test mode currently preserves authored colours instead.
   */
  recolor: boolean;
}

export interface VehicleBodyProvider {
  readonly id: string;
  readonly ownsGpuResources: boolean;
  build(spec: VehicleBodySpec): Group;
  dimensions(silhouette: VehicleSilhouette, modelId?: string): { length: number; width: number };
}
