import { HEAT, POLICE, SCORING } from '@/engine/config';
import type { GameSystem, RunState, SystemContext } from '@/engine/types';

export interface HeatObserver {
  onStarGained(stars: number): void;
  /** Fired once the wanted meter has been maxed out for too long. */
  onBusted(): void;
}

/**
 * The wanted meter. Near-misses raise heat organically; once the 3 km police
 * chase starts the run also gets a minimum wanted level that rises with
 * distance, so the pursuit visibly escalates instead of cooling away.
 */
export class HeatSystem implements GameSystem {
  readonly name = 'heat';

  constructor(private readonly observer: HeatObserver) {}

  update({ state, dt }: SystemContext): void {
    if (state.mode !== 'run' || state.crashed) return;

    const minimumStars = this.policeMinimumStars(state);
    if (state.stars < minimumStars) {
      state.stars = minimumStars;
      state.starProgress = 0;
      state.wantedPeak = Math.max(state.wantedPeak, state.stars);
      this.observer.onStarGained(state.stars);
    }

    state.secondsSinceNearMiss += dt;

    if (state.secondsSinceNearMiss > HEAT.cooldownSeconds && state.stars > minimumStars) {
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

  private policeMinimumStars(state: RunState): number {
    const distanceMeters = state.distance * SCORING.distanceScale;
    if (distanceMeters < POLICE.startDistanceMeters) return 0;

    const extra = Math.floor(
      (distanceMeters - POLICE.startDistanceMeters) / POLICE.starStepMeters,
    );
    return Math.min(HEAT.maxStars, POLICE.minimumStars + extra);
  }
}
