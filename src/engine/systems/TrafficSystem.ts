import type { Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { pickRandom, randomRange } from '@/core/math';
import type { VehicleSilhouette } from '@/domain/cars';
import { DESPAWN_Z, LANE_OFFSETS, SPAWN_Z, TRAFFIC } from '@/engine/config';
import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';
import { randomTrafficLivery, VehicleWorkshop } from '@/engine/vehicles/VehicleWorkshop';
import { activeModelIdAt } from '@/engine/vehicles/vehicleModelConfig';

export interface TrafficObserver {
  onNearMiss(): void;
  onImpact(): void;
}

/** Single-model performance test: every traffic car uses the same body shape. */
const TEST_TRAFFIC_SILHOUETTE: VehicleSilhouette = 'hatch';

/** Spawns, drives and recycles traffic and owns traffic collision geometry. */
export class TrafficSystem implements GameSystem {
  readonly name = 'traffic';

  private readonly active: VehicleObject[] = [];
  private readonly pool: ObjectPool<VehicleObject>;
  private spawnTimer = 0.8;
  private modelCursor = 0;

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
    this.spawnTimer = ctx.state.mode === 'run' ? 0.75 : 0.7;
    this.prefill(ctx.state.mode === 'run');
  }

  get activeCount(): number {
    return this.active.length;
  }

  private spawnStep({ state, dt }: SystemContext): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    const maxActive = state.mode === 'run' ? TRAFFIC.maxActiveRun : TRAFFIC.maxActiveAttract;
    if (this.active.length >= maxActive) {
      this.spawnTimer = state.mode === 'run' ? TRAFFIC.minInterval : TRAFFIC.attractInterval;
      return;
    }

    if (state.mode === 'attract') {
      this.spawnTimer = TRAFFIC.attractInterval;
      this.spawn();
      return;
    }

    const linear = Math.min(1, state.elapsed / TRAFFIC.difficultyRampSeconds);
    const difficulty = Math.pow(linear, 0.72);
    this.spawnTimer =
      TRAFFIC.baseInterval + (TRAFFIC.minInterval - TRAFFIC.baseInterval) * difficulty;
    this.spawn();

    if (state.elapsed > TRAFFIC.doubleSpawnAfter && this.active.length < maxActive) {
      const chance =
        TRAFFIC.doubleSpawnBaseChance +
        (TRAFFIC.doubleSpawnMaxChance - TRAFFIC.doubleSpawnBaseChance) * difficulty;
      if (Math.random() < chance) this.spawn();
    }

    if (
      state.elapsed > TRAFFIC.tripleSpawnAfter &&
      this.active.length < maxActive &&
      Math.random() < TRAFFIC.tripleSpawnMaxChance * difficulty
    ) {
      this.spawn();
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
    vehicle.userData.ramSpin = side * randomRange(6.5, 11);
    state.cameraShake = Math.max(state.cameraShake, 2.1);
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

  private spawn(): VehicleObject {
    const vehicle = this.pool.acquire();

    // All pooled cars already contain the same compressed blue GLB. No body
    // reskin/reclone work is needed when they are recycled back into traffic.
    const lane = pickRandom(LANE_OFFSETS);
    vehicle.position.set(lane + randomRange(-TRAFFIC.laneJitter, TRAFFIC.laneJitter), 0, SPAWN_Z);
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

  private prefill(isRun: boolean): void {
    const count = isRun ? TRAFFIC.runPrefillCount : TRAFFIC.attractPrefillCount;
    const start = isRun ? -102 : -18;
    const gap = isRun ? 27 : 20;

    for (let i = 0; i < count; i++) {
      const vehicle = this.spawn();
      vehicle.position.z = start - i * gap - randomRange(0, isRun ? 7 : 5);

      if (isRun && i < 2 && Math.abs(vehicle.position.x) < 2.6) {
        vehicle.position.x = vehicle.position.x < 0 ? LANE_OFFSETS[0] : LANE_OFFSETS[3];
      }
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
