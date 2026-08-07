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

/** Fast from the first swipe, then ramps hard instead of cruising comfortably. */
export const BASE_TUNING: RunTuning = {
  baseSpeed: 64,
  speedGain: 105,
  rampSeconds: 58,
  steerRate: 14,
  coinPickupRadius: 1.9,
  nearMissWindow: 3.6,
  nitroMultiplier: 1.65,
  nitroSeconds: 2,
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
    rampSeconds: Math.max(28, BASE_TUNING.rampSeconds * (1 - PER_LEVEL.engineRamp * upgrades.engine)),
    steerRate: BASE_TUNING.steerRate * steerScale,
    coinPickupRadius: BASE_TUNING.coinPickupRadius + PER_LEVEL.magnetRadius * upgrades.magnet,
    nearMissWindow:
      BASE_TUNING.nearMissWindow +
      PER_LEVEL.nerveWindow * upgrades.nerve +
      (car.stats.nerve - STAT_BASELINE) * 0.25,
  };
}
