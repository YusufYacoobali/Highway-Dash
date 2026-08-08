import { CarDefinition } from './cars';
import { DEFAULT_MODIFIER, handlingScaleFor, RunModifier } from './runModifier';
import { UpgradeLevels } from './upgrades';

export interface RunTuning {
  baseSpeed: number;
  speedGain: number;
  rampSeconds: number;
  /** How hard the car chases the finger — the proportional term. */
  steerRate: number;
  /** How fast lateral velocity itself can change. Low = heavy, floaty car. */
  steerAccel: number;
  /** Ceiling on lateral velocity, in metres per second. */
  maxSteerSpeed: number;
  coinPickupRadius: number;
  nearMissWindow: number;
  nitroMultiplier: number;
  nitroSeconds: number;
  /* --- Daily modifier scalars, 1 when no modifier is active. --- */
  scoreScale: number;
  coinScale: number;
  trafficScale: number;
  heatScale: number;
}

/**
 * Fast enough to feel exciting immediately, but leaves headroom for authored
 * event spikes. Nitro is intentionally much more dramatic than normal cruise.
 */
export const BASE_TUNING: RunTuning = {
  baseSpeed: 56,
  speedGain: 68,
  rampSeconds: 155,
  // Base steering is a direct chase of the finger, tuned to feel instant.
  // `steerAccel` / `maxSteerSpeed` only apply in drift mode.
  steerRate: 18,
  steerAccel: 52,
  maxSteerSpeed: 16,
  coinPickupRadius: 1.9,
  nearMissWindow: 3.45,
  nitroMultiplier: 1.95,
  nitroSeconds: 2.65,
  scoreScale: 1,
  coinScale: 1,
  trafficScale: 1,
  heatScale: 1,
};

const PER_LEVEL = {
  engineSpeed: 0.045,
  engineRamp: 0.035,
  gripSteer: 0.09,
  /** Grip is felt mostly as turn-in snap, so it leans on acceleration. */
  gripAccel: 0.115,
  gripTopSpeed: 0.055,
  magnetRadius: 0.85,
  nerveWindow: 0.3,
} as const;

const STAT_BASELINE = 3;

export function buildRunTuning(
  car: CarDefinition,
  upgrades: UpgradeLevels,
  modifier: RunModifier = DEFAULT_MODIFIER,
): RunTuning {
  const speedScale =
    (1 + PER_LEVEL.engineSpeed * upgrades.engine) *
    (0.86 + 0.045 * car.stats.speed) *
    modifier.speedScale;
  const handlingScale = (0.85 + 0.05 * car.stats.handling) * handlingScaleFor(modifier);
  const steerScale = (1 + PER_LEVEL.gripSteer * upgrades.grip) * handlingScale;
  const accelScale = (1 + PER_LEVEL.gripAccel * upgrades.grip) * handlingScale;
  const lateralScale = (1 + PER_LEVEL.gripTopSpeed * upgrades.grip) * (0.9 + 0.035 * car.stats.handling);

  return {
    ...BASE_TUNING,
    speedGain: BASE_TUNING.speedGain * speedScale,
    rampSeconds: Math.max(100, BASE_TUNING.rampSeconds * (1 - PER_LEVEL.engineRamp * upgrades.engine)),
    steerRate: BASE_TUNING.steerRate * steerScale,
    steerAccel: BASE_TUNING.steerAccel * accelScale,
    maxSteerSpeed: BASE_TUNING.maxSteerSpeed * lateralScale,
    coinPickupRadius: BASE_TUNING.coinPickupRadius + PER_LEVEL.magnetRadius * upgrades.magnet,
    nearMissWindow:
      BASE_TUNING.nearMissWindow +
      PER_LEVEL.nerveWindow * upgrades.nerve +
      (car.stats.nerve - STAT_BASELINE) * 0.25,
    scoreScale: modifier.scoreScale,
    coinScale: modifier.coinScale,
    trafficScale: modifier.trafficScale,
    heatScale: modifier.heatScale,
  };
}
