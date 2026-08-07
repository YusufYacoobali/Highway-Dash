import { CarDefinition } from './cars';
import { UpgradeLevels } from './upgrades';

/**
 * The complete set of knobs the physics simulation reads. Producing it is a
 * pure function of the player's garage, so difficulty and progression can be
 * reasoned about (and tested) without booting the renderer.
 */
export interface RunTuning {
  /** Speed the car settles at before the ramp kicks in, world units/second. */
  baseSpeed: number;
  /** Extra speed accumulated across `rampSeconds`. */
  speedGain: number;
  rampSeconds: number;
  /** How aggressively the car chases the steering target. */
  steerRate: number;
  /** Lateral half-width in which a coin is vacuumed up. */
  coinPickupRadius: number;
  /** Lateral half-width that still counts as a near-miss when overtaking. */
  nearMissWindow: number;
  nitroMultiplier: number;
  nitroSeconds: number;
}

export const BASE_TUNING: RunTuning = {
  baseSpeed: 48,
  speedGain: 72,
  rampSeconds: 115,
  steerRate: 11,
  coinPickupRadius: 1.9,
  nearMissWindow: 3.6,
  nitroMultiplier: 1.5,
  nitroSeconds: 2.2,
};

const PER_LEVEL = {
  engineSpeed: 0.05,
  engineRamp: 0.07,
  gripSteer: 0.09,
  magnetRadius: 0.85,
  nerveWindow: 0.3,
} as const;

const STAT_BASELINE = 3;

export function buildRunTuning(car: CarDefinition, upgrades: UpgradeLevels): RunTuning {
  const speedScale =
    (1 + PER_LEVEL.engineSpeed * upgrades.engine) * (0.85 + 0.05 * car.stats.speed);
  const steerScale = (1 + PER_LEVEL.gripSteer * upgrades.grip) * (0.85 + 0.05 * car.stats.handling);

  return {
    ...BASE_TUNING,
    speedGain: BASE_TUNING.speedGain * speedScale,
    rampSeconds: Math.max(45, BASE_TUNING.rampSeconds * (1 - PER_LEVEL.engineRamp * upgrades.engine)),
    steerRate: BASE_TUNING.steerRate * steerScale,
    coinPickupRadius: BASE_TUNING.coinPickupRadius + PER_LEVEL.magnetRadius * upgrades.magnet,
    nearMissWindow:
      BASE_TUNING.nearMissWindow +
      PER_LEVEL.nerveWindow * upgrades.nerve +
      (car.stats.nerve - STAT_BASELINE) * 0.25,
  };
}
