import { CylinderGeometry, Mesh, MeshLambertMaterial, Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { pickRandom, randomRange } from '@/core/math';
import { DESPAWN_Z, LANE_OFFSETS, PICKUPS, SPAWN_Z } from '@/engine/config';
import type { GameSystem, SystemContext } from '@/engine/types';

const COIN_SPIN_RATE = 5;
/** Longitudinal window in which a coin can be collected. */
const COLLECT_BEHIND = -2;
const COLLECT_AHEAD = 2.4;

export interface PickupObserver {
  onCoinCollected(value: number): void;
}

/**
 * Lays out the coin runs — the visual "line to follow" that makes weaving feel
 * intentional rather than random — and vacuums them up within the magnet
 * radius supplied by the player's upgrades.
 */
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
        this.scene.add(coin);
        return coin;
      },
      (coin) => {
        coin.visible = true;
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

    // Seed a few runs ahead so the road never starts bare.
    for (let i = 0; i < 3; i++) {
      const run = this.spawnRun();
      for (const coin of run) coin.position.z -= i * 34;
    }
  }

  private collectStep({ state, tuning, player, dt, scroll }: SystemContext): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const coin = this.active[i];
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
        this.recycleAt(i);
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
