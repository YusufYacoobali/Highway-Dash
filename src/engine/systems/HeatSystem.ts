import { HEAT } from '@/engine/config';
import type { GameSystem, RunState, SystemContext } from '@/engine/types';

export interface HeatObserver {
  onStarGained(stars: number): void;
  /** Fired once the wanted meter has been maxed out for too long. */
  onBusted(): void;
}

/**
 * The wanted meter. Chaining near-misses raises heat, backing off cools it, and
 * sitting at five stars long enough ends the run — the risk/reward dial that
 * turns a dodging game into a scoring one.
 */
export class HeatSystem implements GameSystem {
  readonly name = 'heat';

  constructor(private readonly observer: HeatObserver) {}

  update({ state, dt }: SystemContext): void {
    if (state.mode !== 'run' || state.crashed) return;

    state.secondsSinceNearMiss += dt;

    if (state.secondsSinceNearMiss > HEAT.cooldownSeconds && state.stars > 0) {
      state.stars -= 1;
      state.starProgress = 0;
      state.secondsSinceNearMiss = 0;
    }

    if (state.stars >= HEAT.maxStars) {
      state.secondsAtMaxStars += dt;
      if (state.secondsAtMaxStars > HEAT.bustSeconds) this.observer.onBusted();
    } else {
      state.secondsAtMaxStars = 0;
    }
  }

  registerNearMiss(state: RunState): void {
    state.starProgress += 1;
    if (state.starProgress < HEAT.nearMissesPerStar || state.stars >= HEAT.maxStars) return;

    state.starProgress = 0;
    state.stars += 1;
    state.wantedPeak = Math.max(state.wantedPeak, state.stars);
    this.observer.onStarGained(state.stars);
  }
}
