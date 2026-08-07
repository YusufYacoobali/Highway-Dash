/** World-space constants shared by every system. Distances are metres. */

export const LANE_OFFSETS = [-4.5, -1.5, 1.5, 4.5] as const;
export const ROAD_WIDTH = 13;
export const ROAD_LENGTH = 620;

/** How far the car may drift from the centre line before the barriers. */
export const STEER_LIMIT = 5.4;

export const SPAWN_Z = -150;
export const DESPAWN_Z = 20;

export const ATTRACT_SPEED = 30;

export const CAMERA = {
  fov: 66,
  near: 0.4,
  far: 400,
  height: 6.9,
  distance: 14.6,
  followFactor: 0.62,
  followRate: 11,
  nitroFovBoost: 18,
  nitroPullback: 2.6,
} as const;

/**
 * Difficulty is deliberately broad now. The RunDirector supplies short waves
 * of pressure instead of continuously turning every knob upward at once.
 */
export const TRAFFIC = {
  minSpeed: 10,
  maxSpeed: 19,
  playerHalfLength: 2.5,
  collisionWidthScale: 0.82,
  truckCollisionWidthScale: 0.74,
  laneJitter: 0.14,
  truckLaneJitter: 0.03,
  baseInterval: 1.6,
  minInterval: 0.62,
  difficultyRampSeconds: 180,
  attractInterval: 1.3,
  doubleSpawnAfter: 38,
  doubleSpawnBaseChance: 0.03,
  doubleSpawnMaxChance: 0.22,
  tripleSpawnAfter: 105,
  tripleSpawnMaxChance: 0.055,
  runPrefillCount: 4,
  attractPrefillCount: 5,
  /** Meshy GLBs are heavy, so spectacle comes from choreography rather than count. */
  maxActiveRun: 9,
  maxActiveAttract: 6,
  ramSideSpeedMin: 12,
  ramSideSpeedMax: 19,
  ramLiftMin: 9,
  ramLiftMax: 15,
  ramForwardSpeedMin: 26,
  ramForwardSpeedMax: 38,
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

export const NITRO = {
  cooldownSeconds: 4.2,
  frenzyCooldownSeconds: 0.8,
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
  endlessDifficultySeconds: 210,
  eventMinSeconds: 8,
  eventMaxSeconds: 15,
  recoverySeconds: 7,
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
