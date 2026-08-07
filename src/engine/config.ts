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
  playerHalfLength: 3.05,
  /** Fair hitboxes are slightly inset from the visible body. */
  collisionWidthScale: 0.84,
  truckCollisionWidthScale: 0.76,
  /** Visual lane wander; wide trucks stay almost perfectly centred. */
  laneJitter: 0.16,
  truckLaneJitter: 0.04,
  /**
   * Runs open gently, then density climbs aggressively. The eased spawn curve
   * stays readable for the first ~20 seconds but should feel frantic by 90s.
   */
  baseInterval: 2.05,
  minInterval: 0.4,
  difficultyRampSeconds: 92,
  /** Menu traffic stays sparse and decorative. */
  attractInterval: 1.35,
  /** Multi-car beats become common only once the player is settled in. */
  doubleSpawnAfter: 42,
  doubleSpawnBaseChance: 0.05,
  doubleSpawnMaxChance: 0.32,
  tripleSpawnAfter: 78,
  tripleSpawnMaxChance: 0.09,
  runPrefillCount: 4,
  attractPrefillCount: 7,
  /** Nitro impact launch tuning. */
  ramSideSpeedMin: 8,
  ramSideSpeedMax: 13,
  ramLiftMin: 7,
  ramLiftMax: 11,
  ramForwardSpeedMin: 18,
  ramForwardSpeedMax: 27,
} as const;

export const PICKUPS = {
  runLengthMin: 4,
  runLengthMax: 8,
  spacing: 4.2,
  /** Coins now form readable lines on the asphalt rather than floating arcs. */
  arcChance: 0,
  spawnInterval: 2.1,
  value: 5,
  /** Coin radius is 0.62, so this places its centre just above the road. */
  height: 0.68,
  arcHeight: 0,
} as const;

export const POLICE = {
  /** HUD distance at which the chase starts. */
  startDistanceMeters: 3000,
  /** Wanted level cannot cool below this once the chase begins. */
  minimumStars: 2,
  /** Gain another guaranteed wanted star every additional distance chunk. */
  starStepMeters: 900,
  followDistance: 6.4,
  lateralOffset: 3.2,
  followRate: 4.8,
  aggressionRampMeters: 1800,
  /** Nitro temporarily leaves the pursuit farther behind. */
  nitroFallbackDistance: 4.5,
} as const;

export const HEAT = {
  maxStars: 5,
  nearMissesPerStar: 4,
  /** Seconds without a near-miss before the meter cools by one star. */
  cooldownSeconds: 7,
  /** Seconds pinned at max stars before the cops finally box you in. */
  bustSeconds: 12,
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
  reportDelay: 1.55,
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
