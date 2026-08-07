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

/**
 * Interface Segregation in practice: a system only implements the hooks it
 * needs, and the engine never assumes more than `update`.
 */
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
  /** Traffic only: how fast this car is cruising, world units/second. */
  speed: number;
  /** Traffic only: whether the near-miss check has already run for this car. */
  passed: boolean;
}

export type VehicleObject = Group & { userData: VehicleMeta };

export interface VehicleBodySpec {
  silhouette: VehicleSilhouette;
  livery: Livery;
  /**
   * True for the player's car, whose paint must match the garage selection.
   * Traffic leaves this false so the authored glTF colours survive.
   */
  recolor: boolean;
}

/**
 * Supplies the visual body for a silhouette. Two implementations exist — a
 * procedural box car that is always available, and one backed by the glTF
 * pack — which lets the engine start rendering before the models finish loading.
 */
export interface VehicleBodyProvider {
  readonly id: string;
  /**
   * True when each built body owns its geometry and materials outright and can
   * be disposed on removal. glTF bodies are clones that share buffers with a
   * prototype, so disposing one would corrupt every other vehicle.
   */
  readonly ownsGpuResources: boolean;
  build(spec: VehicleBodySpec): Group;
  dimensions(silhouette: VehicleSilhouette): { length: number; width: number };
}
