import type { Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { clamp, damp, randomRange, randomSign } from '@/core/math';
import type { VehicleSilhouette } from '@/domain/cars';
import {
  CONTACT,
  DESPAWN_Z,
  DRAFT,
  HEAT,
  LANE_OFFSETS,
  laneOffsetsFor,
  SPAWN_Z,
  TRAFFIC,
} from '@/engine/config';
import type { GameSystem, RunState, SystemContext, VehicleObject } from '@/engine/types';
import { randomTrafficLivery, VehicleWorkshop } from '@/engine/vehicles/VehicleWorkshop';
import { activeModelIdAt } from '@/engine/vehicles/vehicleModelConfig';

export interface TrafficObserver {
  /**
   * `side` is -1/1 towards the car that was squeezed past, `gap` the absolute
   * lateral distance — the engine decides how close counts as cinematic.
   */
  onNearMiss(side: number, gap: number): void;
  /** A hit with real overlap. Always fatal. */
  onImpact(): void;
  onRam(grace: boolean): void;
  /** A survivable graze. `severity` is 0–1, `side` shoves the player away. */
  onSideswipe(severity: number, side: number): void;
}

/**
 * Outside the ~1.5 m contact half-width but well inside the 3.45 m near-miss
 * window, so the opening pass is a guaranteed near miss and never a crash.
 */
const TEACHER_OFFSET_X = 2.15;
const TEACHER_SPAWN_Z = -178;

const TRAFFIC_SILHOUETTES: readonly VehicleSilhouette[] = ['hatch', 'sedan', 'suv', 'truck'];
/** Trucks are the read-at-a-glance hazard, so they stay comparatively rare. */
const SILHOUETTE_WEIGHTS: readonly number[] = [0.34, 0.32, 0.22, 0.12];

function rollSilhouette(): VehicleSilhouette {
  let roll = Math.random();
  for (let i = 0; i < TRAFFIC_SILHOUETTES.length; i++) {
    roll -= SILHOUETTE_WEIGHTS[i];
    if (roll <= 0) return TRAFFIC_SILHOUETTES[i];
  }
  return TRAFFIC_SILHOUETTES[0];
}

/** Pattern-driven traffic that becomes genuinely busy later without removing escape routes. */
export class TrafficSystem implements GameSystem {
  readonly name = 'traffic';

  private readonly active: VehicleObject[] = [];
  private readonly pool: ObjectPool<VehicleObject>;
  private spawnTimer = 0.8;
  private modelCursor = 0;
  private lastEventSerial = -1;
  private setPieceDelay = -1;
  private highHeatRoadblockReady = true;
  private lanes: readonly number[] = LANE_OFFSETS;

  constructor(
    private readonly scene: Scene,
    private readonly workshop: VehicleWorkshop,
    private readonly observer: TrafficObserver,
  ) {
    this.pool = new ObjectPool<VehicleObject>(
      () => {
        const vehicle = this.workshop.create({
          silhouette: rollSilhouette(),
          livery: randomTrafficLivery(),
          modelId: activeModelIdAt(this.modelCursor++),
          recolor: false,
        });
        this.scene.add(vehicle);
        return vehicle;
      },
      (vehicle) => {
        vehicle.visible = true;
      },
      (vehicle) => {
        vehicle.visible = false;
      },
    );
  }

  update(ctx: SystemContext): void {
    if (!ctx.state.crashed) this.spawnStep(ctx);
    this.driveStep(ctx);
  }

  reset(ctx: Omit<SystemContext, 'dt' | 'scroll'>): void {
    this.recycleAll();
    this.modelCursor = 0;
    this.lastEventSerial = ctx.state.eventSerial;
    this.setPieceDelay = -1;
    this.highHeatRoadblockReady = true;
    this.lanes = LANE_OFFSETS;
    this.spawnTimer = ctx.state.mode === 'run' ? 0.95 : 0.45;
    this.prefill(ctx.state.mode === 'run');
  }

  get activeCount(): number {
    return this.active.length;
  }

  private spawnStep({ state, dt }: SystemContext): void {
    this.lanes = laneOffsetsFor(state.laneCount);
    const maxActive =
      state.mode === 'run'
        ? maxActiveForRun(state.elapsed, state.nitroRemaining > 0)
        : TRAFFIC.maxActiveAttract;

    if (state.mode === 'run' && state.stars < HEAT.roadblocksAt) this.highHeatRoadblockReady = true;
    if (
      state.mode === 'run' &&
      state.stars >= HEAT.roadblocksAt &&
      this.highHeatRoadblockReady &&
      this.active.length <= maxActive - Math.max(2, this.lanes.length - 1)
    ) {
      this.spawnRoadblock(maxActive, Math.floor(Math.random() * 4));
      this.highHeatRoadblockReady = false;
    }

    if (state.mode === 'run' && state.eventSerial !== this.lastEventSerial) {
      this.lastEventSerial = state.eventSerial;
      this.setPieceDelay =
        state.event === 'roadblock' || state.event === 'construction' || state.event === 'laneSqueeze'
          ? randomRange(0.7, 1.15)
          : -1;
    }

    if (this.setPieceDelay >= 0) {
      this.setPieceDelay -= dt;
      if (this.setPieceDelay <= 0) {
        this.setPieceDelay = -1;
        if (state.event === 'roadblock') this.spawnRoadblock(maxActive, state.eventVariant);
        else if (state.event === 'construction') this.spawnConstructionGate(maxActive, state.eventVariant);
        else if (state.event === 'laneSqueeze') this.spawnThreeLaneWelcome(maxActive, state.eventVariant);
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    if (this.active.length >= maxActive) {
      this.spawnTimer = state.mode === 'run' ? 0.34 : TRAFFIC.attractInterval;
      return;
    }

    if (state.mode === 'attract') {
      this.spawnTimer = TRAFFIC.attractInterval;
      this.spawn();
      if (this.active.length <= maxActive - 2 && Math.random() < 0.38) this.spawnPair(-5);
      return;
    }

    const difficulty = clamp(state.elapsed / TRAFFIC.difficultyRampSeconds, 0, 1);
    const lateDensity = clamp((state.elapsed - 55) / 110, 0, 1);
    const base = TRAFFIC.baseInterval + (TRAFFIC.minInterval - TRAFFIC.baseInterval) * difficulty;
    const pressureFactor = 1.24 - state.trafficIntensity * 0.34;
    const recoveryFactor =
      state.event === 'cruise'
        ? 1.08 - lateDensity * 0.06
        : state.event === 'coinRush'
          ? 1.13
          : 1;
    const lateFactor = 1 - lateDensity * 0.24;
    const nitroFactor = state.nitroRemaining > 0 ? 0.54 : 1;
    this.spawnTimer = Math.max(
      TRAFFIC.minInterval,
      base * pressureFactor * recoveryFactor * lateFactor * nitroFactor,
    );

    this.spawn();

    const doubleChance =
      TRAFFIC.doubleSpawnBaseChance +
      (TRAFFIC.doubleSpawnMaxChance - TRAFFIC.doubleSpawnBaseChance) * difficulty;

    if (
      state.elapsed > TRAFFIC.doubleSpawnAfter &&
      this.active.length <= maxActive - 2 &&
      Math.random() < doubleChance * state.trafficIntensity
    ) {
      this.spawnPair();
    }

    if (
      state.elapsed > TRAFFIC.tripleSpawnAfter &&
      state.event !== 'cruise' &&
      this.active.length <= maxActive - Math.max(2, this.lanes.length - 1) &&
      Math.random() < TRAFFIC.tripleSpawnMaxChance * difficulty
    ) {
      this.spawnWallWithGap();
    }

    if (
      state.elapsed > 145 &&
      state.nitroRemaining <= 0 &&
      this.active.length <= maxActive - 2 &&
      Math.random() < 0.07 + lateDensity * 0.05
    ) {
      this.spawnPair(-13);
    }
  }

  private driveStep({ state, tuning, player, dt }: SystemContext): void {
    let drafting = false;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const vehicle = this.active[i];

      if (vehicle.userData.rammed) {
        this.updateRammed(vehicle, dt);
        if (vehicle.position.z > DESPAWN_Z + 12 || vehicle.position.y < -1) this.recycleAt(i);
        continue;
      }

      // Where the car was relative to the player *before* the step. At full
      // nitro the pair close ~12 m in a capped frame, far wider than the
      // contact box, so a point-in-box test would let them pass through
      // each other on any device that dips below 30 fps.
      const previousDz = vehicle.position.z - player.position.z;
      vehicle.position.z += (state.speed - this.queueSpeed(vehicle)) * dt;
      this.applyFlinch(vehicle, player.position.x, player.position.z, state, dt);

      const dz = vehicle.position.z - player.position.z;
      const dx = Math.abs(vehicle.position.x - player.position.x);
      const halfWidth = this.contactHalfWidth(vehicle, player);
      // dz only ever increases, so the box was crossed if the car started
      // before the far edge and finished past the near one.
      const overlapped =
        previousDz < TRAFFIC.playerHalfLength &&
        dz > -TRAFFIC.playerHalfLength &&
        dx < halfWidth;

      // The menu car is indestructible and everything bounces off it. The
      // attract loop is the shop window, so it plays the power fantasy.
      if (state.mode === 'attract') {
        if (overlapped) {
          this.launchVehicle(vehicle, player.position.x, state, false);
          state.cameraShake = Math.max(state.cameraShake, 1.6);
        }
        if (vehicle.position.z > DESPAWN_Z) this.recycleAt(i);
        continue;
      }

      if (!state.crashed) {
        if (overlapped && this.resolveContact(vehicle, player.position.x, state, dx, halfWidth)) {
          continue;
        }
        if (overlapped && state.crashed) return;

        // Sitting in the wake of the car ahead. Checked before the pass latch
        // so the same car can be drafted and then near-missed.
        if (dz < -DRAFT.minGap && dz > -DRAFT.maxGap && dx < DRAFT.lateral) {
          drafting = true;
        }

        if (!vehicle.userData.passed && dz > 1.5) {
          vehicle.userData.passed = true;
          if (dx < tuning.nearMissWindow && !vehicle.userData.scraped) {
            const side = Math.sign(vehicle.position.x - player.position.x) || randomSign();
            this.observer.onNearMiss(side, dx);
          }
        }
      }

      if (vehicle.position.z > DESPAWN_Z) this.recycleAt(i);
    }

    state.drafting = state.mode === 'run' && !state.crashed && drafting;
  }

  /**
   * A car never drives faster than whatever is directly in front of it in its
   * own lane. Cars are given a random cruise speed at spawn, so without this
   * the quicker one in a pair simply passed through the slower one.
   *
   * Lower z is further up the road, so "ahead" means a smaller z.
   */
  private queueSpeed(vehicle: VehicleObject): number {
    let speed = vehicle.userData.speed;

    for (const other of this.active) {
      if (other === vehicle || other.userData.rammed) continue;
      if (Math.abs(other.position.x - vehicle.position.x) > TRAFFIC.followLateral) continue;

      const gap = vehicle.position.z - other.position.z;
      if (gap <= 0 || gap > TRAFFIC.followDistance) continue;

      if (other.userData.speed < speed) speed = other.userData.speed;
    }

    return speed;
  }

  private contactHalfWidth(vehicle: VehicleObject, player: VehicleObject): number {
    const vehicleWidthScale =
      vehicle.userData.silhouette === 'truck'
        ? TRAFFIC.truckCollisionWidthScale
        : TRAFFIC.collisionWidthScale;
    return (
      (vehicle.userData.width * vehicleWidthScale +
        player.userData.width * TRAFFIC.collisionWidthScale) /
      2
    );
  }

  /**
   * Decides what a contact *means*. Returns true when the car survived as a
   * separate object (launched or scraped) and the caller should keep going;
   * the caller checks `state.crashed` for the fatal case.
   */
  private resolveContact(
    vehicle: VehicleObject,
    playerX: number,
    state: RunState,
    dx: number,
    halfWidth: number,
  ): boolean {
    if (state.nitroRemaining > 0) {
      this.launchVehicle(vehicle, playerX, state, false);
      this.observer.onRam(false);
      return true;
    }

    if (state.nitroGraceRemaining > 0) {
      this.launchVehicle(vehicle, playerX, state, true);
      this.observer.onRam(true);
      return true;
    }

    // 0 at the very edge of the boxes, 1 dead centre.
    const overlapRatio = 1 - dx / halfWidth;

    if (vehicle.userData.scraped) return true;

    // Being shoved into a second car by the scrape you just survived is the
    // least fair death in the genre. But the immunity used to *ignore* the
    // contact outright, which at 100 m/s let the player ghost clean through a
    // whole row. It now downgrades the hit to a scrape instead: you always
    // bounce off something, you are never simply not there.
    const grazed =
      overlapRatio < CONTACT.sideswipeRatio || state.contactImmunityRemaining > 0;

    if (grazed) {
      vehicle.userData.scraped = true;
      const side = Math.sign(playerX - vehicle.position.x) || randomSign();
      // Both cars are thrown apart — the traffic car visibly loses the fight.
      vehicle.userData.driftVelocityX = -side * 5.2;
      this.observer.onSideswipe(
        Math.min(1, overlapRatio / CONTACT.sideswipeRatio),
        side,
      );
      return true;
    }

    this.observer.onImpact();
    return false;
  }

  /**
   * Traffic flinches away from a car bearing down on it. It reads as drivers
   * reacting, and it widens the gap the player was already aiming at — which
   * is the honest way to keep a busy road survivable.
   */
  private applyFlinch(
    vehicle: VehicleObject,
    playerX: number,
    playerZ: number,
    state: RunState,
    dt: number,
  ): void {
    const laneX = vehicle.userData.laneX ?? vehicle.position.x;
    const dz = vehicle.position.z - playerZ;
    const dx = vehicle.position.x - playerX;

    const bearingDown =
      state.mode === 'run' &&
      !state.crashed &&
      dz < 0 &&
      dz > -TRAFFIC.reactDistance &&
      Math.abs(dx) < TRAFFIC.reactLateral;

    let target = 0;
    if (bearingDown) {
      const urgency = 1 - Math.abs(dz) / TRAFFIC.reactDistance;
      target = (Math.sign(dx) || randomSign()) * TRAFFIC.reactDriftSpeed * urgency;
    }

    const drift = damp(
      vehicle.userData.driftVelocityX ?? 0,
      target,
      TRAFFIC.reactDriftAccel,
      dt,
    );
    vehicle.userData.driftVelocityX = drift;
    // Clamped against the car's own lane, not the road. Drifting relative to
    // the road let a flinch wander far enough to close a set-piece's gap.
    vehicle.position.x = clamp(
      clamp(
        vehicle.position.x + drift * dt,
        laneX - TRAFFIC.reactMaxDrift,
        laneX + TRAFFIC.reactMaxDrift,
      ),
      -TRAFFIC.reactMaxOffset,
      TRAFFIC.reactMaxOffset,
    );

    if (!bearingDown && Math.abs(drift) < 0.35) {
      vehicle.position.x = damp(vehicle.position.x, laneX, TRAFFIC.reactRecoverRate, dt);
    }
  }

  private launchVehicle(
    vehicle: VehicleObject,
    playerX: number,
    state: SystemContext['state'],
    grace: boolean,
  ): void {
    const relative = vehicle.position.x - playerX;
    const side = relative === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(relative);
    const force = grace ? 0.68 : 1;

    vehicle.userData.rammed = true;
    vehicle.userData.passed = true;
    vehicle.userData.ramVelocityX =
      side * randomRange(TRAFFIC.ramSideSpeedMin, TRAFFIC.ramSideSpeedMax) * force;
    vehicle.userData.ramVelocityY = randomRange(TRAFFIC.ramLiftMin, TRAFFIC.ramLiftMax) * force;
    vehicle.userData.ramVelocityZ =
      -randomRange(TRAFFIC.ramForwardSpeedMin, TRAFFIC.ramForwardSpeedMax) * force;
    vehicle.userData.ramSpin = side * randomRange(7.5, 12.5) * force;
    state.cameraShake = Math.max(state.cameraShake, grace ? 0.8 : 2.8);
  }

  private updateRammed(vehicle: VehicleObject, dt: number): void {
    const vx = vehicle.userData.ramVelocityX ?? 0;
    let vy = vehicle.userData.ramVelocityY ?? 0;
    const vz = vehicle.userData.ramVelocityZ ?? -20;
    const spin = vehicle.userData.ramSpin ?? 6;

    vehicle.position.x += vx * dt;
    vehicle.position.y += vy * dt;
    vehicle.position.z += vz * dt;
    vy -= 19 * dt;
    vehicle.userData.ramVelocityY = vy;
    vehicle.rotation.y += spin * dt;
    vehicle.rotation.z += spin * 0.7 * dt;
  }

  /** Nearest lane index to a world x, or -1 when the car is between lanes. */
  private laneIndexFor(x: number): number {
    let best = -1;
    let bestDistance = Infinity;
    for (let lane = 0; lane < this.lanes.length; lane++) {
      const distance = Math.abs(this.lanes[lane] - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = lane;
      }
    }
    return bestDistance <= 1.6 ? best : -1;
  }

  /**
   * Would putting a car in this lane, at this z, leave the player no opening?
   *
   * Individual set-pieces all leave a gap, but nothing used to stop the
   * ordinary spawn cadence — or a second set-piece — from dropping a car into
   * exactly that gap. This is the backstop that makes "there is always a way
   * through" true globally rather than per-pattern.
   */
  private sealsRoad(lane: number, z: number): boolean {
    const occupied = new Set<number>([lane]);
    for (const other of this.active) {
      if (other.userData.rammed) continue;
      if (Math.abs(other.position.z - z) > TRAFFIC.safeGapZ) continue;
      const index = this.laneIndexFor(other.position.x);
      if (index >= 0) occupied.add(index);
    }
    return occupied.size >= this.lanes.length;
  }

  private spawn(laneIndex?: number, zOffset = 0): VehicleObject {
    const vehicle = this.pool.acquire();
    let lane = laneIndex ?? this.pickOpenLane();
    let z = SPAWN_Z + zOffset;

    if (this.sealsRoad(lane, z)) {
      // Prefer another lane in the same row; if the row is genuinely full,
      // drop this car well behind so it forms its own row instead.
      const alternative = this.lanes.findIndex(
        (_, candidate) => candidate !== lane && !this.sealsRoad(candidate, z),
      );
      if (alternative >= 0) lane = alternative;
      else z -= TRAFFIC.safeGapZ * 2.5;
    }

    const laneCentre = this.lanes[lane] ?? this.lanes[Math.floor(this.lanes.length / 2)] ?? 0;

    // Never drop a car on top of one already occupying this lane. Set pieces
    // and the pair/wall spawners pass an explicit lane, so they bypass the
    // occupancy weighting in `pickOpenLane` entirely.
    let blockedBy = Infinity;
    for (const other of this.active) {
      if (other.userData.rammed) continue;
      if (Math.abs(other.position.x - laneCentre) > TRAFFIC.followLateral) continue;
      if (other.position.z > z + TRAFFIC.minSpawnGap) continue;
      if (other.position.z < z - TRAFFIC.minSpawnGap * 3) continue;
      blockedBy = Math.min(blockedBy, other.position.z);
    }
    if (blockedBy !== Infinity) z = blockedBy - TRAFFIC.minSpawnGap;

    const jitter =
      vehicle.userData.silhouette === 'truck' ? TRAFFIC.truckLaneJitter : TRAFFIC.laneJitter;
    const laneX = laneCentre + randomRange(-jitter, jitter);

    vehicle.position.set(laneX, 0, z);
    vehicle.rotation.set(0, 0, 0);
    vehicle.userData.speed = randomRange(TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
    vehicle.userData.laneX = laneX;
    vehicle.userData.driftVelocityX = 0;
    vehicle.userData.scraped = false;
    vehicle.userData.passed = false;
    vehicle.userData.rammed = false;
    vehicle.userData.ramVelocityX = 0;
    vehicle.userData.ramVelocityY = 0;
    vehicle.userData.ramVelocityZ = 0;
    vehicle.userData.ramSpin = 0;
    this.active.push(vehicle);
    return vehicle;
  }

  private spawnPair(zOffset = 0): void {
    if (this.lanes.length < 2) return;
    const first = Math.floor(Math.random() * this.lanes.length);
    let second = Math.floor(Math.random() * (this.lanes.length - 1));
    if (second >= first) second += 1;
    this.spawn(first, zOffset);
    this.spawn(second, zOffset - 2.5);
  }

  private spawnWallWithGap(zOffset = 0, forcedGap?: number): void {
    const gap = forcedGap ?? Math.floor(Math.random() * this.lanes.length);
    for (let lane = 0; lane < this.lanes.length; lane++) {
      if (lane !== gap) this.spawn(lane, zOffset + randomRange(-1.2, 1.2));
    }
  }

  private spawnRoadblock(maxActive: number, variant: number): void {
    if (this.lanes.length === 3) {
      if (this.active.length > maxActive - 2) return;
      const gap = Math.floor(Math.random() * 3);
      const diagonal = variant % 2 === 1;
      let ordinal = 0;
      for (let lane = 0; lane < 3; lane++) {
        if (lane === gap) continue;
        this.spawn(lane, diagonal ? -ordinal * 6 : randomRange(-1, 1));
        ordinal += 1;
      }
      this.spawnTimer = Math.max(this.spawnTimer, 1.4);
      return;
    }

    const flavour = variant % 4;

    if (flavour === 1 && this.active.length <= maxActive - 4) {
      const firstGap = Math.random() < 0.5 ? 0 : 3;
      this.spawn(firstGap === 0 ? 2 : 1, 0);
      this.spawn(firstGap === 0 ? 3 : 0, -1.5);
      this.spawn(firstGap === 0 ? 0 : 3, -13);
      this.spawn(firstGap === 0 ? 1 : 2, -15);
      this.spawnTimer = Math.max(this.spawnTimer, 1.6);
      return;
    }

    if (flavour === 2 && this.active.length <= maxActive - 3) {
      const gap = Math.floor(Math.random() * this.lanes.length);
      let z = 0;
      for (let lane = 0; lane < this.lanes.length; lane++) {
        if (lane === gap) continue;
        this.spawn(lane, z);
        z -= 5.5;
      }
      this.spawnTimer = Math.max(this.spawnTimer, 1.5);
      return;
    }

    if (flavour === 3 && this.active.length <= maxActive - 3) {
      const gap = Math.random() < 0.5 ? 1 : 2;
      this.spawnWallWithGap(0, gap);
      this.spawnTimer = Math.max(this.spawnTimer, 1.45);
      return;
    }

    if (this.active.length > maxActive - 3) return;
    this.spawnWallWithGap();
    this.spawnTimer = Math.max(this.spawnTimer, 1.3);
  }

  private spawnConstructionGate(maxActive: number, variant: number): void {
    if (this.lanes.length === 3) {
      if (this.active.length > maxActive - 2) return;
      const gap = Math.floor(Math.random() * 3);
      this.spawn((gap + 1) % 3, 0);
      this.spawn((gap + 2) % 3, -8);
      this.spawnTimer = Math.max(this.spawnTimer, 1.5);
      return;
    }

    const flavour = variant % 4;

    if (flavour === 1 && this.active.length <= maxActive - 3) {
      const mirror = Math.random() < 0.5;
      this.spawn(mirror ? 0 : 3, 0);
      this.spawn(mirror ? 2 : 1, -8);
      this.spawn(mirror ? 1 : 2, -17);
      this.spawnTimer = Math.max(this.spawnTimer, 1.6);
      return;
    }

    if (flavour === 2 && this.active.length <= maxActive - 3) {
      const gap = Math.random() < 0.5 ? 1 : 2;
      this.spawnWallWithGap(-2, gap);
      this.spawnTimer = Math.max(this.spawnTimer, 1.5);
      return;
    }

    if (flavour === 3 && this.active.length <= maxActive - 2) {
      const leftOpen = Math.random() < 0.5;
      this.spawn(leftOpen ? 2 : 0, 0);
      this.spawn(leftOpen ? 3 : 1, -7);
      this.spawnTimer = Math.max(this.spawnTimer, 1.55);
      return;
    }

    if (this.active.length > maxActive - 2) return;
    const blockRight = Math.random() < 0.5;
    this.spawn(blockRight ? 2 : 0, 0);
    this.spawn(blockRight ? 3 : 1, -3);
    this.spawnTimer = Math.max(this.spawnTimer, 1.45);
  }

  private spawnThreeLaneWelcome(maxActive: number, variant: number): void {
    if (this.lanes.length !== 3 || this.active.length > maxActive - 2) return;
    const gap = variant % 3;
    this.spawn((gap + 1) % 3, 0);
    this.spawn((gap + 2) % 3, variant === 3 ? -7 : -2.5);
    this.spawnTimer = Math.max(this.spawnTimer, 1.55);
  }

  private pickOpenLane(): number {
    const weights = this.lanes.map((laneX) => {
      let nearby = 0;
      for (const vehicle of this.active) {
        if (Math.abs(vehicle.position.x - laneX) < 1.35 && vehicle.position.z < -116) nearby += 1;
      }
      return nearby;
    });
    const min = Math.min(...weights);
    const candidates = weights.flatMap((weight, lane) => (weight === min ? [lane] : []));
    return candidates[Math.floor(Math.random() * candidates.length)] ?? Math.floor(this.lanes.length / 2);
  }

  private prefill(isRun: boolean): void {
    const count = isRun ? TRAFFIC.runPrefillCount : TRAFFIC.attractPrefillCount;
    const start = isRun ? -108 : -18;
    const gap = isRun ? 29 : 18;

    for (let i = 0; i < count; i++) {
      const vehicle = this.spawn(i % this.lanes.length);
      vehicle.position.z = start - i * gap - randomRange(0, isRun ? 8 : 5);
      if (isRun && i < 2) {
        // Open the middle so the first thing a run shows is a clear line.
        vehicle.position.x = i === 0 ? LANE_OFFSETS[0] : LANE_OFFSETS[3];
        vehicle.userData.laneX = vehicle.position.x;
      }
    }

    if (isRun) this.spawnTeacher();
  }

  /**
   * The scripted opening. A player who touches nothing still passes this car
   * inside the near-miss window, so the first thing the run teaches is that
   * driving *close* is the point — learned by doing it, not by reading a hint.
   *
   * It sits just outside the contact box, so it cannot punish that lesson.
   */
  private spawnTeacher(): void {
    const side = randomSign();
    const vehicle = this.spawn(side < 0 ? 1 : 2);
    vehicle.position.x = side * TEACHER_OFFSET_X;
    vehicle.position.z = TEACHER_SPAWN_Z;
    vehicle.userData.laneX = vehicle.position.x;
    // Slow, so it arrives on schedule and is easy to read coming.
    vehicle.userData.speed = TRAFFIC.minSpeed;
  }

  private recycleAt(index: number): void {
    const [vehicle] = this.active.splice(index, 1);
    vehicle.rotation.set(0, 0, 0);
    vehicle.position.y = 0;
    vehicle.userData.rammed = false;
    vehicle.userData.scraped = false;
    vehicle.userData.driftVelocityX = 0;
    this.pool.release(vehicle);
  }

  private recycleAll(): void {
    while (this.active.length > 0) this.recycleAt(this.active.length - 1);
  }
}

function maxActiveForRun(elapsed: number, nitroActive: boolean): number {
  let max = elapsed >= 145 ? 14 : elapsed >= 95 ? 13 : elapsed >= 55 ? 11 : 9;
  if (nitroActive) max += 1;
  return Math.min(TRAFFIC.maxActiveRun, max);
}
