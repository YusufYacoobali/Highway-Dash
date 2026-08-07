import { CylinderGeometry, Mesh, MeshLambertMaterial, Scene } from 'three';

import { ObjectPool } from '@/core/ObjectPool';
import { pickRandom, randomRange } from '@/core/math';
import { DESPAWN_Z, LANE_OFFSETS, PICKUPS, SPAWN_Z } from '@/engine/config';
import type { GameSystem, RunEventId, SystemContext } from '@/engine/types';

const COIN_SPIN_RATE = 5;
const COLLECT_BEHIND = -2;
const COLLECT_AHEAD = 2.4;
const COLLECT_ANIMATION_SECONDS = 0.24;

export interface PickupObserver {
  onCoinCollected(value: number): void;
}

/** Lays out normal coin lines plus denser authored reward beats. */
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
        this.spawnTimer = intervalForEvent(ctx.state.event);
        this.spawnRun(ctx.state.event);
      }
    }
    this.collectStep(ctx);
  }

  reset(): void {
    while (this.active.length > 0) this.recycleAt(this.active.length - 1);
    this.spawnTimer = PICKUPS.spawnInterval;

    for (let i = 0; i < 3; i++) {
      const run = this.spawnRun('cruise');
      for (const coin of run) coin.position.z -= i * 38;
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

  private spawnRun(event: RunEventId): Mesh[] {
    const laneIndex = Math.floor(Math.random() * LANE_OFFSETS.length);
    const lane = LANE_OFFSETS[laneIndex];
    const coinRush = event === 'coinRush';
    const count = Math.round(
      randomRange(
        coinRush ? PICKUPS.runLengthMax + 2 : PICKUPS.runLengthMin,
        coinRush ? PICKUPS.runLengthMax + 6 : PICKUPS.runLengthMax,
      ),
    );
    const spacing = coinRush ? 3.05 : PICKUPS.spacing;
    const direction = laneIndex <= 1 ? 1 : -1;
    const neighbourIndex = Math.max(0, Math.min(LANE_OFFSETS.length - 1, laneIndex + direction));
    const neighbour = LANE_OFFSETS[neighbourIndex];
    const run: Mesh[] = [];

    for (let i = 0; i < count; i++) {
      const coin = this.pool.acquire();
      const wave = coinRush ? Math.min(1, Math.max(0, (i - 2) / Math.max(1, count - 5))) : 0;
      const x = coinRush ? lane + (neighbour - lane) * (0.5 - Math.cos(wave * Math.PI) * 0.5) : lane;
      coin.position.set(x, PICKUPS.height, SPAWN_Z - i * spacing);
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

function intervalForEvent(event: RunEventId): number {
  if (event === 'coinRush') return 0.72;
  if (event === 'nitroRush') return 1.0;
  if (event === 'roadblock' || event === 'construction') return 1.85;
  return PICKUPS.spawnInterval;
}
