/** World-space constants shared by every system. Distances are metres. */

export const LANE_OFFSETS = [-4.5, -1.5, 1.5, 4.5] as const;
export const THREE_LANE_OFFSETS = [-4, 0, 4] as const;
export const ROAD_WIDTH = 13;
export const ROAD_LENGTH = 620;

export const laneOffsetsFor = (laneCount: 3 | 4): readonly number[] =>
  laneCount === 3 ? THREE_LANE_OFFSETS : LANE_OFFSETS;

/** How far the car may drift from the centre line before the barriers. */
export const STEER_LIMIT = 5.4;

/**
 * Base steering is first-order and deliberately reflexive — the car goes where
 * the finger is, now. Anything else reads as input lag on a game whose whole
 * appeal is threading gaps at 400 km/h.
 *
 * The second-order model with real lateral momentum still exists, but only as
 * DRIFT MODE, granted for a fixed window by a drift gate. Making the heavy car
 * a temporary, opted-into state turns what would be a handling tax into a
 * risk/reward decision.
 */
export const STEERING = {
  /** Lateral velocity retained when the barrier is hit. */
  wallBounce: -0.22,

  drift: {
    /** Lateral acceleration (m/s²) on turn-in while drifting. */
    accel: 52,
    /** Softer deceleration when easing off, so the car carries through. */
    releaseDamping: 40,
    maxSpeed: 16,
    /** Proportional gain — low enough to leave a settling zone at the target. */
    gain: 9.5,
    /** How much the car floats at top speed, as a fraction of low-speed grip. */
    highSpeedGripLoss: 0.24,
    /** Speed (m/s) at which the full grip loss has been applied. */
    gripLossSpeed: 130,
  },
} as const;

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
  /**
   * Traffic flinches away when the player bears down on it. Purely cosmetic
   * pressure that also happens to widen the escape gap, which is the fair way
   * to make a busy road readable.
   */
  reactDistance: 27,
  reactLateral: 2.3,
  reactDriftSpeed: 2.6,
  reactDriftAccel: 3.4,
  reactRecoverRate: 1.6,
  reactMaxOffset: 5.6,
  /**
   * A flinch is a twitch inside the lane, never a lane change. Unclamped it
   * could wander a car most of a lane's width and quietly seal the gap a
   * set-piece had deliberately left open.
   */
  reactMaxDrift: 0.95,
  /**
   * Traffic drives in a queue, not through each other. Every car picks a
   * random cruise speed, so without this a faster car simply overlapped the
   * slower one ahead of it in the same lane.
   */
  followLateral: 1.8,
  followDistance: 17,
  /** Minimum longitudinal room between two cars sharing a lane at spawn. */
  minSpawnGap: 14,
  /**
   * Longitudinal band used when deciding whether a spawn would seal the road.
   * Roughly a car length plus the room needed to steer around one.
   */
  safeGapZ: 11,
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

/**
 * Wanted is a chase system with a visible, escapable ending. Holding five stars
 * lets the interceptors close for `bustCloseSeconds` before they can PIT you —
 * long enough to see it coming and either nitro clear or let the heat decay.
 */
export const HEAT = {
  maxStars: 5,
  nearMissesPerStar: 5,
  cooldownSeconds: 12,
  /**
   * Above `highHeatFrom` stars the heat falls much faster. Under the flat
   * 12 s rule, max heat was effectively permanent: near-misses are constant on
   * a busy road, so the meter never dropped and the chase never ended.
   */
  highHeatFrom: 4,
  highHeatCooldownSeconds: 5,
  policeStartsAt: 2,
  roadblocksAt: 4,
  /** Seconds pinned at max stars before the police can make contact. */
  bustCloseSeconds: 12,
  /** Threat fraction at which the HUD starts screaming about it. */
  bustWarnAt: 0.4,
  /**
   * Nitro is *the* escape, so it unwinds the PIT clock far faster than the
   * clock builds. One full boost clears a full bar — that is the rule the
   * player is being asked to learn, so it has to be decisive enough to feel.
   */
  nitroEscapeRate: 3.6,
  /** Metres the interceptors are physically shoved back while boosting. */
  nitroPushback: 9,
  /** Longitudinal/lateral contact box for the PIT manoeuvre. */
  bustContactZ: 3.1,
  bustContactX: 2.5,
  /**
   * The siren wash is driven by an interceptor actually filling the mirror,
   * not merely by having heat. `sirenFar` is where the glow starts to appear,
   * `sirenNear` where it is at full strength.
   */
  sirenFar: 15,
  sirenNear: 5,
  sirenLateral: 4.5,
} as const;

/**
 * Distance is the survival stat; SCORE is the risk stat and the one the HUD
 * leads with. Score accrues per metre but is multiplied by the live chain, so
 * the safe lane and the gap between two trucks pay very differently.
 */
export const SCORING = {
  nearMissCoins: 3,
  comboWindow: 2.15,
  distanceScale: 2.2,
  speedToKmh: 3.9,
  scorePerMetre: 1.15,
  multiplierMin: 1,
  multiplierMax: 12,
  multiplierPerNearMiss: 0.22,
  multiplierPerRam: 0.38,
  multiplierPerCoin: 0.015,
  /** Multiplier lost per second once the chain window lapses. */
  multiplierDecayRate: 1.35,
  /** Fraction of the multiplier surrendered by a scrape. */
  sideswipeMultiplierKeep: 0.4,
} as const;

/**
 * A scrape is a graze along the flank; a crash is a hit with real overlap.
 * The survivable band is deliberately narrow — only the outer quarter of the
 * contact depth — so clipping a wing mirror is forgiven and actually hitting a
 * car is not. Widen `sideswipeRatio` and the game stops having stakes.
 */
export const CONTACT = {
  sideswipeRatio: 0.26,
  sideswipeSpeedKeep: 0.72,
  sideswipeKnock: 1.35,
  sideswipeShake: 2.1,
  sideswipeSlowMoSeconds: 0.09,
  sideswipeSlowMoScale: 0.5,
  /**
   * Just long enough that the car you were shoved into by a scrape cannot kill
   * you on the same beat — not long enough to drive through a queue.
   */
  sideswipeImmunitySeconds: 0.2,
} as const;

/** Nitro is a short, unmistakable power fantasy followed by a forgiving exit. */
export const NITRO = {
  cooldownSeconds: 4.8,
  frenzyCooldownSeconds: 0.55,
  graceSeconds: 1.0,
  ignitionHitStopSeconds: 0.055,
  ignitionHitStopScale: 0.16,
} as const;

/**
 * Slow motion is a punctuation mark, not a texture.
 *
 * It used to fire on every near miss — but lanes are 3 m apart and the scoring
 * window is 3.45 m, so simply passing a car in the next lane while sitting
 * dead centre in your own qualified. The result was near-permanent slow-mo.
 *
 * Scoring still uses the wide window. Slow motion uses an *absolute* gap, so
 * it stays a genuine close call regardless of how far NERVE has widened the
 * scoring window, and a cooldown stops a wall of traffic strobing the game.
 */
export const SLOW_MO = {
  /** Lateral gap (m) under which a pass earns the slow-mo beat. */
  grazeGap: 2.1,
  /** Tighter still — the paint-swapper, which drops into a deeper stall. */
  hugeGap: 1.75,
  /** Minimum wall-clock seconds between two slow-mo beats. */
  cooldownSeconds: 1.6,
  /** Long enough to register as a moment rather than a hitch. */
  nearMissSeconds: 0.32,
  nearMissScale: 0.38,
  hugeNearMissScale: 0.26,
  ramSeconds: 0.075,
  ramScale: 0.34,
} as const;

export const RUN_DIRECTOR = {
  /** The scripted opening: quiet road, one teacher car, no events. */
  graceSeconds: 13,
  endlessDifficultySeconds: 205,
  eventMinSeconds: 8,
  eventMaxSeconds: 15,
  recoverySeconds: 6.5,
  /**
   * A shuffled deck is not pacing. Recovery beats compress towards
   * `minRecoveryScale` and event beats stretch towards `maxEventScale` as the
   * run goes, so each tension/release cycle peaks higher than the last.
   */
  paceRampSeconds: 260,
  minRecoveryScale: 0.42,
  maxEventScale: 1.28,
} as const;

/**
 * The multiplier is not just a payout — holding a big chain visibly turns the
 * difficulty up. That makes a long chain a hard mode the player opted into,
 * with a reward they opted into, which is the whole replay loop of a score
 * attack game.
 */
export const ESCALATION = {
  /** Multiplier at which escalation starts, and where it maxes out. */
  from: 2,
  to: 8,
  trafficBoost: 0.22,
  intensityBoost: 0.16,
  cameraPullIn: 1.9,
  fovBoost: 4.5,
} as const;

/**
 * Sitting in a car's wake. Turns "avoid traffic" into "use traffic", which is
 * the most engaging thing that can be done to the moment-to-moment run.
 */
export const DRAFT = {
  /** Longitudinal band behind the car being drafted, in metres ahead. */
  minGap: 3.2,
  maxGap: 15,
  lateral: 1.7,
  chargeSeconds: 1.5,
  /** Charge lost per second once the player falls out of the wake. */
  decayRate: 1.9,
  multiplierBonus: 0.4,
  coins: 12,
  surgeSeconds: 1.5,
  surgeMultiplier: 1.22,
  nitroCooldownCut: 0.9,
} as const;

/**
 * Risk gates: the only place the player chooses something. Two arches, one
 * safe, one worth double — picked by which half of the road you drive through.
 */
export const GATE = {
  firstAt: 34,
  intervalMin: 26,
  intervalMax: 36,
  spawnZ: -190,
  /** Player z at which the choice is locked in. */
  triggerZ: -2,
  postHeight: 6.2,
  postThickness: 0.62,
  bannerHeight: 1.5,
  boostSeconds: 11,
  boostTrafficBoost: 0.3,
  safeCoins: 90,
  riskMultiplierBonus: 0.6,
  /** Score scale while the reward window is live, per gate kind. */
  doubleScoreScale: 2,
  driftScoreScale: 3,
  /** Chance a given gate offers the drift bargain instead of plain double. */
  driftChance: 0.4,
} as const;

/** A near miss should be felt, not just announced. */
export const NEAR_MISS = {
  /** Lateral camera kick towards the car that was just squeezed past. */
  cameraNudge: 0.62,
  nudgeDecay: 4.2,
  /** Seconds of speed streaks fired off by a close pass. */
  flashSeconds: 0.22,
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
