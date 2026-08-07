import { CylinderGeometry, Mesh, MeshLambertMaterial, Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { pickRandom, randomRange } from '@/core/math';
import { DESPAWN_Z, LANE_OFFSETS, PICKUPS, SPAWN_Z } from '@/engine/config';
import type { GameSystem, SystemContext } from '@/engine/types';

const COIN_SPIN_RATE = 5;
const COLLECT_BEHIND = -2;
const COLLECT_AHEAD = 2.4;
const COLLECT_ANIMATION_SECONDS = 0.24;

export interface PickupObserver {
  onCoinCollected(value: number): void;
}

/** Lays out and animates collectible coin runs. */
export class PickupSystem implements GameSystem {
  readonly name = 'pickups';

  private readonly active: Mesh[] = [];
  private readonly pool: ObjectPool<Mesh>;
  private spawnTimer = 1;

  constructor(
    private readonly scene: Scene,
    private readonly observer: PickupObserver,
  ) {
    const geometry = new CylinderGeometry(0.62, 0.62, 0.14, 10);
    const material = new MeshLambertMaterial({ color: 0xffc02e, emissive: 0x6b4400 });

    this.pool = new ObjectPool<Mesh>(
      () => {
        const coin = new Mesh(geometry, material);
        coin.rotation.x = Math.PI / 2;
        coin.userData.collecting = -1;
        this.scene.add(coin);
        return coin;
      },
      (coin) => {
        coin.visible = true;
        coin.scale.setScalar(1);
        coin.userData.collecting = -1;
      },
      (coin) => {
        coin.visible = false;
      },
    );
  }

  update(ctx: SystemContext): void {
    if (!ctx.state.crashed) {
      this.spawnTimer -= ctx.dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = PICKUPS.spawnInterval;
        this.spawnRun();
      }
    }
    this.collectStep(ctx);
  }

  reset(): void {
    while (this.active.length > 0) this.recycleAt(this.active.length - 1);
    this.spawnTimer = PICKUPS.spawnInterval;

    for (let i = 0; i < 3; i++) {
      const run = this.spawnRun();
      for (const coin of run) coin.position.z -= i * 34;
    }
  }

  private collectStep({ state, tuning, player, dt, scroll }: SystemContext): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const coin = this.active[i];
      const collectingAge = Number(coin.userData.collecting ?? -1);

      if (collectingAge >= 0) {
        const age = collectingAge + dt;
        const t = Math.min(1, age / COLLECT_ANIMATION_SECONDS);
        coin.userData.collecting = age;

        // Snap toward the player, pop upward, spin faster, then shrink away.
        const chase = Math.min(1, dt * 18);
        coin.position.x += (player.position.x - coin.position.x) * chase;
        coin.position.z += (player.position.z - coin.position.z) * chase;
        coin.position.y += dt * (5 + t * 8);
        coin.rotation.z += dt * COIN_SPIN_RATE * 3.2;

        const pop = 1 + Math.sin(t * Math.PI) * 0.7;
        const scale = Math.max(0.001, pop * (1 - t));
        coin.scale.setScalar(scale);

        if (t >= 1) this.recycleAt(i);
        continue;
      }

      coin.position.z += scroll;
      coin.rotation.z += dt * COIN_SPIN_RATE;

      const dz = coin.position.z - player.position.z;
      const collectable =
        state.mode === 'run' &&
        !state.crashed &&
        dz > COLLECT_BEHIND &&
        dz < COLLECT_AHEAD &&
        Math.abs(coin.position.x - player.position.x) < tuning.coinPickupRadius;

      if (collectable) {
        this.observer.onCoinCollected(PICKUPS.value);
        coin.userData.collecting = 0;
        continue;
      }

      if (coin.position.z > DESPAWN_Z) this.recycleAt(i);
    }
  }

  /** One run of coins in a single lane, sometimes arced over a gap. */
  private spawnRun(): Mesh[] {
    const lane = pickRandom(LANE_OFFSETS);
    const count = Math.round(randomRange(PICKUPS.runLengthMin, PICKUPS.runLengthMax));
    const arced = Math.random() < PICKUPS.arcChance;
    const run: Mesh[] = [];

    for (let i = 0; i < count; i++) {
      const coin = this.pool.acquire();
      const t = count > 1 ? i / (count - 1) : 0;
      coin.position.set(
        lane,
        arced ? PICKUPS.height + Math.sin(t * Math.PI) * PICKUPS.arcHeight : PICKUPS.height,
        SPAWN_Z - i * PICKUPS.spacing,
      );
      this.active.push(coin);
      run.push(coin);
    }
    return run;
  }

  private recycleAt(index: number): void {
    const [coin] = this.active.splice(index, 1);
    this.pool.release(coin);
  }
}
