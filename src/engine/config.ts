/** World-space constants shared by every system. Distances are metres. */

export const LANE_OFFSETS = [-4.5, -1.5, 1.5, 4.5] as const;
export const ROAD_WIDTH = 13;
export const ROAD_LENGTH = 620;

/** How far the car may drift from the centre line before the barriers. */
export const STEER_LIMIT = 5.4;

export const SPAWN_Z = -150;
export const DESPAWN_Z = 20;

export const ATTRACT_SPEED = 24;

export const CAMERA = {
  fov: 62,
  near: 0.4,
  far: 400,
  height: 6.9,
  distance: 14.6,
  /** Camera x follows the car at this fraction so the road stays framed. */
  followFactor: 0.55,
  followRate: 7,
  nitroFovBoost: 10,
  nitroPullback: 1.3,
} as const;

export const TRAFFIC = {
  minSpeed: 11,
  maxSpeed: 18,
  /** Longitudinal half-length of the player's collision box. */
  playerHalfLength: 3.2,
  /** Seconds between spawns at rest; shrinks as the run speeds up. */
  baseInterval: 1.15,
  minInterval: 0.42,
  /**
   * The attract loop runs far sparser than gameplay. Menu traffic never
   * despawns early, so a gameplay cadence would leave forty cars on screen
   * behind the title — the most expensive frame in the whole app.
   */
  attractInterval: 0.95,
  /** After this many seconds, occasionally spawn a second car in the same beat. */
  doubleSpawnAfter: 22,
  doubleSpawnChance: 0.16,
} as const;

export const PICKUPS = {
  runLengthMin: 4,
  runLengthMax: 8,
  spacing: 4.2,
  arcChance: 0.45,
  spawnInterval: 2.1,
  value: 5,
  height: 1.4,
  arcHeight: 1.9,
} as const;

export const HEAT = {
  maxStars: 5,
  nearMissesPerStar: 4,
  /** Seconds without a near-miss before the meter cools by one star. */
  cooldownSeconds: 7,
  /** Seconds pinned at max stars before the cops box you in. */
  bustSeconds: 9,
} as const;

export const SCORING = {
  /** Near-miss base payout, plus one coin per three combo steps. */
  nearMissCoins: 2,
  comboWindow: 1.6,
  /** Simulation units → the metres shown in the HUD. */
  distanceScale: 2.2,
  /** Simulation units → km/h shown in the HUD. */
  speedToKmh: 3.9,
} as const;

export const NITRO = {
  /** Seconds after a boost ends before the button re-arms. */
  cooldownSeconds: 5,
} as const;

export const CRASH = {
  /** Seconds of slow-motion tumble before the summary is reported. */
  reportDelay: 1.25,
  spinMin: 3.4,
  spinMax: 5.6,
  liftMin: 7,
  liftMax: 10,
} as const;

/** Vehicle body lengths after the glTF models are normalised. */
export const VEHICLE_LENGTH = {
  sports: 5.4,
  sedan: 5.4,
  hatch: 5,
  suv: 5.8,
  truck: 8.4,
} as const;
