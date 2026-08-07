import type { Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { pickRandom, randomRange } from '@/core/math';
import { DESPAWN_Z, LANE_OFFSETS, SPAWN_Z, TRAFFIC } from '@/engine/config';
import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';
import {
  randomTrafficLivery,
  randomTrafficSilhouette,
  VehicleWorkshop,
} from '@/engine/vehicles/VehicleWorkshop';

export interface TrafficObserver {
  /** The player squeezed past a car without touching it. */
  onNearMiss(): void;
  /** The player hit a car. */
  onImpact(): void;
}

/** Spawns, drives and recycles traffic and owns traffic collision geometry. */
export class TrafficSystem implements GameSystem {
  readonly name = 'traffic';

  private readonly active: VehicleObject[] = [];
  private readonly pool: ObjectPool<VehicleObject>;
  private spawnTimer = 1;

  constructor(
    private readonly scene: Scene,
    private readonly workshop: VehicleWorkshop,
    private readonly observer: TrafficObserver,
  ) {
    this.pool = new ObjectPool<VehicleObject>(
      () => {
        const vehicle = this.workshop.create({
          silhouette: randomTrafficSilhouette(),
          livery: randomTrafficLivery(),
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
    this.spawnTimer = ctx.state.mode === 'run' ? 1.6 : 0.8;
    this.prefill(ctx.state.mode === 'run');
  }

  get activeCount(): number {
    return this.active.length;
  }

  private spawnStep({ state, dt }: SystemContext): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    if (state.mode === 'attract') {
      this.spawnTimer = TRAFFIC.attractInterval;
      this.spawn();
      return;
    }

    const progress = Math.min(1, state.elapsed / TRAFFIC.difficultyRampSeconds);
    this.spawnTimer =
      TRAFFIC.baseInterval + (TRAFFIC.minInterval - TRAFFIC.baseInterval) * progress;
    this.spawn();

    if (state.elapsed > TRAFFIC.doubleSpawnAfter && Math.random() < TRAFFIC.doubleSpawnChance) {
      this.spawn();
    }
  }

  private driveStep({ state, tuning, player, dt }: SystemContext): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const vehicle = this.active[i];
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

  private spawn(): VehicleObject {
    const vehicle = this.pool.acquire();

    // Re-roll the pooled car type on every spawn so a single truck in the pool
    // cannot become every fifth vehicle forever.
    const silhouette = randomTrafficSilhouette();
    if (vehicle.userData.silhouette !== silhouette) {
      this.workshop.reskin(vehicle, silhouette, randomTrafficLivery(), false);
    }

    const lane = pickRandom(LANE_OFFSETS);
    const jitter = silhouette === 'truck' ? TRAFFIC.truckLaneJitter : TRAFFIC.laneJitter;
    vehicle.position.set(lane + randomRange(-jitter, jitter), 0, SPAWN_Z);
    vehicle.userData.speed = randomRange(TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
    vehicle.userData.passed = false;
    this.active.push(vehicle);
    return vehicle;
  }

  /** Seeds a small amount of readable traffic without front-loading difficulty. */
  private prefill(isRun: boolean): void {
    const count = isRun ? TRAFFIC.runPrefillCount : TRAFFIC.attractPrefillCount;
    const start = isRun ? -118 : -18;
    const gap = isRun ? 34 : 22;

    for (let i = 0; i < count; i++) {
      const vehicle = this.spawn();
      vehicle.position.z = start - i * gap - randomRange(0, isRun ? 8 : 5);

      // Give the first few seconds a clear central escape route.
      if (isRun && i < 3 && Math.abs(vehicle.position.x) < 2.6) {
        vehicle.position.x = vehicle.position.x < 0 ? LANE_OFFSETS[0] : LANE_OFFSETS[3];
      }
    }
  }

  private recycleAt(index: number): void {
    const [vehicle] = this.active.splice(index, 1);
    this.pool.release(vehicle);
  }

  private recycleAll(): void {
    while (this.active.length > 0) this.recycleAt(this.active.length - 1);
  }
}
