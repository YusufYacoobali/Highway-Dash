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

/**
 * Spawns, drives and recycles the oncoming traffic, and reports the two events
 * that matter to gameplay. Scoring rules deliberately live elsewhere — this
 * system only knows about geometry.
 */
export class TrafficSystem implements GameSystem {
  readonly name = 'traffic';

  private readonly active: VehicleObject[] = [];
  private readonly pool: ObjectPool<VehicleObject>;
  private spawnTimer = 0.4;

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
    this.spawnTimer = 0.4;
    this.prefill(ctx.state.mode === 'run');
  }

  /** Number of cars currently on stage — used by tests and the debug overlay. */
  get activeCount(): number {
    return this.active.length;
  }

  private spawnStep({ state, dt }: SystemContext): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    if (state.mode === 'attract') {
      // The attract loop uses a fixed cadence so the menu never gets crowded.
      this.spawnTimer = TRAFFIC.attractInterval;
      this.spawn();
      return;
    }

    this.spawnTimer = Math.max(TRAFFIC.minInterval, TRAFFIC.baseInterval - state.speed / 190);
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
        const halfWidth = (vehicle.userData.width + player.userData.width) / 2;

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
    vehicle.position.set(pickRandom(LANE_OFFSETS) + randomRange(-0.35, 0.35), 0, SPAWN_Z);
    vehicle.userData.speed = randomRange(TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
    vehicle.userData.passed = false;
    this.active.push(vehicle);
    return vehicle;
  }

  /**
   * Seeds the road so the first frame is never empty. A run gets a wider,
   * sparser runway with the centre lanes cleared, giving the player a moment
   * to find the controls before the first real gap.
   */
  private prefill(isRun: boolean): void {
    const start = isRun ? -52 : -14;
    const gap = isRun ? 17 : 11;

    for (let i = 0; i < 12; i++) {
      const vehicle = this.spawn();
      vehicle.position.z = start - i * gap - randomRange(0, 6);
      if (isRun && i < 5 && Math.abs(vehicle.position.x) < 2.5) {
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
