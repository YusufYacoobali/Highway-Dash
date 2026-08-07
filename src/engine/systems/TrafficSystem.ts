import type { Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { clamp, randomRange } from '@/core/math';
import type { VehicleSilhouette } from '@/domain/cars';
import { DESPAWN_Z, LANE_OFFSETS, SPAWN_Z, TRAFFIC } from '@/engine/config';
import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';
import { randomTrafficLivery, VehicleWorkshop } from '@/engine/vehicles/VehicleWorkshop';
import { activeModelIdAt } from '@/engine/vehicles/vehicleModelConfig';

export interface TrafficObserver {
  onNearMiss(): void;
  onImpact(): void;
  onRam(): void;
}

/** Single-model performance mode is preserved while the authored GLB pipeline is stabilized. */
const TEST_TRAFFIC_SILHOUETTE: VehicleSilhouette = 'hatch';

/**
 * Traffic now serves readable patterns. Density still rises over a long run,
 * but event beats decide when pressure is applied and every wall leaves a gap.
 */
export class TrafficSystem implements GameSystem {
  readonly name = 'traffic';

  private readonly active: VehicleObject[] = [];
  private readonly pool: ObjectPool<VehicleObject>;
  private spawnTimer = 0.8;
  private modelCursor = 0;
  private lastEventSerial = -1;
  private setPieceDelay = -1;

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
    this.spawnTimer = ctx.state.mode === 'run' ? 1.05 : 0.7;
    this.prefill(ctx.state.mode === 'run');
  }

  get activeCount(): number {
    return this.active.length;
  }

  private spawnStep({ state, dt }: SystemContext): void {
    const maxActive = state.mode === 'run' ? TRAFFIC.maxActiveRun : TRAFFIC.maxActiveAttract;

    if (state.mode === 'run' && state.eventSerial !== this.lastEventSerial) {
      this.lastEventSerial = state.eventSerial;
      this.setPieceDelay = state.event === 'roadblock' || state.event === 'construction' ? 1.0 : -1;
    }

    if (this.setPieceDelay >= 0) {
      this.setPieceDelay -= dt;
      if (this.setPieceDelay <= 0) {
        this.setPieceDelay = -1;
        if (state.event === 'roadblock') this.spawnRoadblock(maxActive);
        else if (state.event === 'construction') this.spawnConstructionGate(maxActive);
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    if (this.active.length >= maxActive) {
      this.spawnTimer = state.mode === 'run' ? 0.5 : TRAFFIC.attractInterval;
      return;
    }

    if (state.mode === 'attract') {
      this.spawnTimer = TRAFFIC.attractInterval;
      this.spawn();
      return;
    }

    const difficulty = clamp(state.elapsed / TRAFFIC.difficultyRampSeconds, 0, 1);
    const base = TRAFFIC.baseInterval + (TRAFFIC.minInterval - TRAFFIC.baseInterval) * difficulty;
    const pressureFactor = 1.25 - state.trafficIntensity * 0.35;
    const recoveryFactor = state.event === 'cruise' ? 1.12 : state.event === 'coinRush' ? 1.22 : 1;
    this.spawnTimer = Math.max(TRAFFIC.minInterval, base * pressureFactor * recoveryFactor);

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
      this.active.length <= maxActive - 3 &&
      Math.random() < TRAFFIC.tripleSpawnMaxChance * difficulty
    ) {
      this.spawnWallWithGap();
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
            this.launchFromNitro(vehicle, player.position.x, state);
            this.observer.onRam();
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

  private launchFromNitro(
    vehicle: VehicleObject,
    playerX: number,
    state: SystemContext['state'],
  ): void {
    const relative = vehicle.position.x - playerX;
    const side = relative === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(relative);

    vehicle.userData.rammed = true;
    vehicle.userData.passed = true;
    vehicle.userData.ramVelocityX =
      side * randomRange(TRAFFIC.ramSideSpeedMin, TRAFFIC.ramSideSpeedMax);
    vehicle.userData.ramVelocityY = randomRange(TRAFFIC.ramLiftMin, TRAFFIC.ramLiftMax);
    vehicle.userData.ramVelocityZ = -randomRange(
      TRAFFIC.ramForwardSpeedMin,
      TRAFFIC.ramForwardSpeedMax,
    );
    vehicle.userData.ramSpin = side * randomRange(7.5, 12.5);
    state.cameraShake = Math.max(state.cameraShake, 2.5);
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
    vehicle.position.set(
      LANE_OFFSETS[lane] + randomRange(-TRAFFIC.laneJitter, TRAFFIC.laneJitter),
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

  private spawnPair(): void {
    const first = Math.floor(Math.random() * LANE_OFFSETS.length);
    let second = Math.floor(Math.random() * (LANE_OFFSETS.length - 1));
    if (second >= first) second += 1;
    this.spawn(first, 0);
    this.spawn(second, -2.5);
  }

  /** Three cars can be dramatic because one entire lane is always explicitly open. */
  private spawnWallWithGap(): void {
    const gap = Math.floor(Math.random() * LANE_OFFSETS.length);
    for (let lane = 0; lane < LANE_OFFSETS.length; lane++) {
      if (lane !== gap) this.spawn(lane, randomRange(-1.2, 1.2));
    }
  }

  private spawnRoadblock(maxActive: number): void {
    if (this.active.length > maxActive - 3) return;
    this.spawnWallWithGap();
    this.spawnTimer = Math.max(this.spawnTimer, 1.3);
  }

  private spawnConstructionGate(maxActive: number): void {
    if (this.active.length > maxActive - 2) return;
    const blockRight = Math.random() < 0.5;
    this.spawn(blockRight ? 2 : 0, 0);
    this.spawn(blockRight ? 3 : 1, -3);
    this.spawnTimer = Math.max(this.spawnTimer, 1.45);
  }

  private pickOpenLane(): number {
    const weights = LANE_OFFSETS.map((laneX) => {
      let nearby = 0;
      for (const vehicle of this.active) {
        if (Math.abs(vehicle.position.x - laneX) < 1.2 && vehicle.position.z < -118) nearby += 1;
      }
      return nearby;
    });
    const min = Math.min(...weights);
    const candidates = weights.flatMap((weight, lane) => (weight === min ? [lane] : []));
    return candidates[Math.floor(Math.random() * candidates.length)] ?? 1;
  }

  private prefill(isRun: boolean): void {
    const count = isRun ? TRAFFIC.runPrefillCount : TRAFFIC.attractPrefillCount;
    const start = isRun ? -108 : -18;
    const gap = isRun ? 31 : 20;

    for (let i = 0; i < count; i++) {
      const vehicle = this.spawn(i % LANE_OFFSETS.length);
      vehicle.position.z = start - i * gap - randomRange(0, isRun ? 8 : 5);

      // First two reads are deliberately wide, giving a new run a clear centre corridor.
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
