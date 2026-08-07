import { CarDefinition } from './cars';
import { UpgradeLevels } from './upgrades';

export interface RunTuning {
  baseSpeed: number;
  speedGain: number;
  rampSeconds: number;
  steerRate: number;
  coinPickupRadius: number;
  nearMissWindow: number;
  nitroMultiplier: number;
  nitroSeconds: number;
}

/**
 * Fast enough to feel exciting immediately, but leaves headroom for authored
 * event spikes. Difficulty should come from readable situations, not a 60s wall.
 */
export const BASE_TUNING: RunTuning = {
  baseSpeed: 56,
  speedGain: 68,
  rampSeconds: 155,
  steerRate: 14,
  coinPickupRadius: 1.9,
  nearMissWindow: 3.45,
  nitroMultiplier: 1.72,
  nitroSeconds: 2.2,
};

const PER_LEVEL = {
  engineSpeed: 0.045,
  engineRamp: 0.035,
  gripSteer: 0.09,
  magnetRadius: 0.85,
  nerveWindow: 0.3,
} as const;

const STAT_BASELINE = 3;

export function buildRunTuning(car: CarDefinition, upgrades: UpgradeLevels): RunTuning {
  const speedScale =
    (1 + PER_LEVEL.engineSpeed * upgrades.engine) * (0.86 + 0.045 * car.stats.speed);
  const steerScale = (1 + PER_LEVEL.gripSteer * upgrades.grip) * (0.85 + 0.05 * car.stats.handling);

  return {
    ...BASE_TUNING,
    speedGain: BASE_TUNING.speedGain * speedScale,
    rampSeconds: Math.max(100, BASE_TUNING.rampSeconds * (1 - PER_LEVEL.engineRamp * upgrades.engine)),
    steerRate: BASE_TUNING.steerRate * steerScale,
    coinPickupRadius: BASE_TUNING.coinPickupRadius + PER_LEVEL.magnetRadius * upgrades.magnet,
    nearMissWindow:
      BASE_TUNING.nearMissWindow +
      PER_LEVEL.nerveWindow * upgrades.nerve +
      (car.stats.nerve - STAT_BASELINE) * 0.25,
  };
}
