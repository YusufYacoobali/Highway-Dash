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
  /** More aggressive chase movement sells speed without changing controls. */
  followFactor: 0.62,
  followRate: 11,
  nitroFovBoost: 16,
  nitroPullback: 2,
} as const;

export const TRAFFIC = {
  minSpeed: 10,
  maxSpeed: 18,
  /** Longitudinal half-length of the player's collision box. */
  playerHalfLength: 2.5,
  /** Fair hitboxes are slightly inset from the visible body. */
  collisionWidthScale: 0.84,
  truckCollisionWidthScale: 0.76,
  laneJitter: 0.18,
  truckLaneJitter: 0.04,
  /**
   * Hyper-casual pace: readable for only the opening seconds, then traffic
   * density climbs hard so the screen constantly asks for another move.
   */
  baseInterval: 1.35,
  minInterval: 0.28,
  difficultyRampSeconds: 50,
  attractInterval: 1.05,
  doubleSpawnAfter: 14,
  doubleSpawnBaseChance: 0.08,
  doubleSpawnMaxChance: 0.38,
  tripleSpawnAfter: 32,
  tripleSpawnMaxChance: 0.15,
  runPrefillCount: 5,
  attractPrefillCount: 8,
  /** Nitro impact launch tuning. */
  ramSideSpeedMin: 10,
  ramSideSpeedMax: 16,
  ramLiftMin: 8,
  ramLiftMax: 13,
  ramForwardSpeedMin: 22,
  ramForwardSpeedMax: 32,
} as const;

export const PICKUPS = {
  runLengthMin: 6,
  runLengthMax: 10,
  spacing: 3.6,
  arcChance: 0,
  spawnInterval: 1.45,
  value: 5,
  height: 0.68,
  arcHeight: 0,
} as const;

export const HEAT = {
  maxStars: 5,
  nearMissesPerStar: 4,
  cooldownSeconds: 7,
  bustSeconds: 12,
} as const;

export const SCORING = {
  nearMissCoins: 2,
  comboWindow: 1.6,
  distanceScale: 2.2,
  speedToKmh: 3.9,
} as const;

export const NITRO = {
  /** Faster re-arm keeps the high-energy loop moving. */
  cooldownSeconds: 3.5,
} as const;

export const CRASH = {
  reportDelay: 1.55,
  spinMin: 3.4,
  spinMax: 5.6,
  liftMin: 7,
  liftMax: 10,
} as const;

/**
 * Vehicle target lengths are intentionally 80% of the old values. glTF cars
 * are normalised against these values, so every authored model shrinks evenly.
 */
export const VEHICLE_LENGTH = {
  sports: 4.32,
  sedan: 4.32,
  hatch: 4,
  suv: 4.64,
  truck: 6.72,
} as const;
