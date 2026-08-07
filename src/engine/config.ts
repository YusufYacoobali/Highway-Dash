/** World-space constants shared by every system. Distances are metres. */

export const LANE_OFFSETS = [-4.5, -1.5, 1.5, 4.5] as const;
export const THREE_LANE_OFFSETS = [-4, 0, 4] as const;
export const ROAD_WIDTH = 13;
export const ROAD_LENGTH = 620;

export const laneOffsetsFor = (laneCount: 3 | 4): readonly number[] =>
  laneCount === 3 ? THREE_LANE_OFFSETS : LANE_OFFSETS;

/** How far the car may drift from the centre line before the barriers. */
export const STEER_LIMIT = 5.4;

export const SPAWN_Z = -150;
export const DESPAWN_Z = 20;

export const ATTRACT_SPEED = 38;

export const CAMERA = {
  fov: 66,
  near: 0.4,
  far: 400,
  height: 6.9,
  distance: 14.6,
  followFactor: 0.62,
  followRate: 11,
  nitroFovBoost: 23,
  nitroPullback: 3.4,
} as const;

/**
 * Starts readable, then deliberately fills the road later in the run. The
 * director still owns fairness; these values simply give it enough cars to
 * create pressure instead of leaving giant empty stretches.
 */
export const TRAFFIC = {
  minSpeed: 10,
  maxSpeed: 20,
  playerHalfLength: 2.5,
  collisionWidthScale: 0.82,
  truckCollisionWidthScale: 0.74,
  laneJitter: 0.14,
  truckLaneJitter: 0.03,
  baseInterval: 1.5,
  minInterval: 0.38,
  difficultyRampSeconds: 155,
  attractInterval: 0.92,
  doubleSpawnAfter: 30,
  doubleSpawnBaseChance: 0.045,
  doubleSpawnMaxChance: 0.34,
  tripleSpawnAfter: 78,
  tripleSpawnMaxChance: 0.11,
  runPrefillCount: 5,
  attractPrefillCount: 7,
  maxActiveRun: 14,
  maxActiveAttract: 8,
  ramSideSpeedMin: 15,
  ramSideSpeedMax: 24,
  ramLiftMin: 11,
  ramLiftMax: 18,
  ramForwardSpeedMin: 32,
  ramForwardSpeedMax: 48,
} as const;

export const PICKUPS = {
  runLengthMin: 6,
  runLengthMax: 10,
  spacing: 3.6,
  arcChance: 0,
  spawnInterval: 1.55,
  value: 5,
  height: 0.68,
  arcHeight: 0,
} as const;

/** Wanted is a spectacle/chase system now, not an invisible countdown to death. */
export const HEAT = {
  maxStars: 5,
  nearMissesPerStar: 5,
  cooldownSeconds: 12,
  policeStartsAt: 2,
  roadblocksAt: 4,
} as const;

export const SCORING = {
  nearMissCoins: 3,
  comboWindow: 2.15,
  distanceScale: 2.2,
  speedToKmh: 3.9,
} as const;

/** Nitro is a short, unmistakable power fantasy followed by a forgiving exit. */
export const NITRO = {
  cooldownSeconds: 4.8,
  frenzyCooldownSeconds: 0.55,
  graceSeconds: 1.0,
  ignitionHitStopSeconds: 0.055,
  ignitionHitStopScale: 0.16,
} as const;

export const SLOW_MO = {
  nearMissSeconds: 0.11,
  nearMissScale: 0.58,
  hugeNearMissScale: 0.42,
  ramSeconds: 0.075,
  ramScale: 0.34,
} as const;

export const RUN_DIRECTOR = {
  graceSeconds: 13,
  endlessDifficultySeconds: 205,
  eventMinSeconds: 8,
  eventMaxSeconds: 15,
  recoverySeconds: 6.5,
} as const;

export const CRASH = {
  reportDelay: 1.55,
  spinMin: 3.4,
  spinMax: 5.6,
  liftMin: 7,
  liftMax: 10,
} as const;

/** Uniform visual + collision scale for every player and traffic vehicle. */
export const VEHICLE_SCALE = 0.8;

/** Authored target lengths before the global vehicle scale is applied. */
export const VEHICLE_LENGTH = {
  sports: 5.4,
  sedan: 5.4,
  hatch: 5,
  suv: 5.8,
  truck: 8.4,
} as const;
