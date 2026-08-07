import type { Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { clamp, randomRange } from '@/core/math';
import type { VehicleSilhouette } from '@/domain/cars';
import {
  DESPAWN_Z,
  HEAT,
  LANE_OFFSETS,
  laneOffsetsFor,
  SPAWN_Z,
  TRAFFIC,
} from '@/engine/config';
import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';
import { randomTrafficLivery, VehicleWorkshop } from '@/engine/vehicles/VehicleWorkshop';
import { activeModelIdAt } from '@/engine/vehicles/vehicleModelConfig';

export interface TrafficObserver {
  onNearMiss(): void;
  onImpact(): void;
  onRam(grace: boolean): void;
}

const TEST_TRAFFIC_SILHOUETTE: VehicleSilhouette = 'hatch';

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
          silhouette: TEST_TRAFFIC_SILHOUETTE,
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
    for (let i = this.active.length - 1; i >= 0; i--) {
      const vehicle = this.active[i];

      if (vehicle.userData.rammed) {
        this.updateRammed(vehicle, dt);
        if (vehicle.position.z > DESPAWN_Z + 12 || vehicle.position.y < -1) this.recycleAt(i);
        continue;
      }

      vehicle.position.z += (state.speed - vehicle.userData.speed) * dt;

      if (state.mode === 'run' && !state.crashed) {
        const dx = Math.abs(vehicle.position.x - player.position.x);
        const dz = vehicle.position.z - player.position.z;
        const vehicleWidthScale =
          vehicle.userData.silhouette === 'truck'
            ? TRAFFIC.truckCollisionWidthScale
            : TRAFFIC.collisionWidthScale;
        const halfWidth =
          (vehicle.userData.width * vehicleWidthScale +
            player.userData.width * TRAFFIC.collisionWidthScale) /
          2;

        if (dz > -TRAFFIC.playerHalfLength && dz < TRAFFIC.playerHalfLength && dx < halfWidth) {
          if (state.nitroRemaining > 0) {
            this.launchVehicle(vehicle, player.position.x, state, false);
            this.observer.onRam(false);
            continue;
          }

          if (state.nitroGraceRemaining > 0) {
            this.launchVehicle(vehicle, player.position.x, state, true);
            this.observer.onRam(true);
            continue;
          }

          this.observer.onImpact();
          return;
        }

        if (!vehicle.userData.passed && dz > 1.5) {
          vehicle.userData.passed = true;
          if (dx < tuning.nearMissWindow) this.observer.onNearMiss();
        }
      }

      if (vehicle.position.z > DESPAWN_Z) this.recycleAt(i);
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

  private spawn(laneIndex?: number, zOffset = 0): VehicleObject {
    const vehicle = this.pool.acquire();
    const lane = laneIndex ?? this.pickOpenLane();
    const laneX = this.lanes[lane] ?? this.lanes[Math.floor(this.lanes.length / 2)] ?? 0;
    vehicle.position.set(
      laneX + randomRange(-TRAFFIC.laneJitter, TRAFFIC.laneJitter),
      0,
      SPAWN_Z + zOffset,
    );
    vehicle.rotation.set(0, 0, 0);
    vehicle.userData.speed = randomRange(TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
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
      if (isRun && i < 2) vehicle.position.x = i === 0 ? LANE_OFFSETS[0] : LANE_OFFSETS[3];
    }
  }

  private recycleAt(index: number): void {
    const [vehicle] = this.active.splice(index, 1);
    vehicle.rotation.set(0, 0, 0);
    vehicle.position.y = 0;
    vehicle.userData.rammed = false;
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
