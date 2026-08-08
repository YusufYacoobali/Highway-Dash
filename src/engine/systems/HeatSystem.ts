import { clamp01 } from '@/core/math';
import { HEAT } from '@/engine/config';
import type { GameSystem, RunState, SystemContext } from '@/engine/types';

/** How fast the threat unwinds once the player is no longer pinned at max. */
const THREAT_RELIEF_RATE = 0.85;

export interface HeatObserver {
  onStarGained(stars: number): void;
  /** The player boosted clear of a closing PIT and broke the pursuit. */
  onShookOff(stars: number): void;
}

/**
 * Heat is earned by risky driving and decays when the player calms down.
 *
 * Holding five stars is the only thing in the game that can kill you without
 * touching traffic: the interceptors spend `bustCloseSeconds` drawing level
 * before they can PIT. That window is long enough to read the HUD and either
 * burn nitro or stop chaining near-misses and let the heat bleed off — so the
 * wanted meter finally has stakes without ever being an invisible timer.
 */
export class HeatSystem implements GameSystem {
  readonly name = 'heat';

  /** Mirrored from tuning so `registerNearMiss` can see the daily modifier. */
  private heatScale = 1;

  constructor(private readonly observer: HeatObserver) {}

  reset({ tuning }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    this.heatScale = tuning.heatScale;
  }

  update({ state, tuning, dt }: SystemContext): void {
    if (state.mode !== 'run' || state.crashed) return;
    this.heatScale = tuning.heatScale;

    state.secondsSinceNearMiss += dt;

    const cooldown =
      state.stars >= HEAT.highHeatFrom
        ? HEAT.highHeatCooldownSeconds
        : HEAT.cooldownSeconds;

    if (state.secondsSinceNearMiss > cooldown && state.stars > 0) {
      state.stars -= 1;
      state.starProgress = 0;
      state.secondsSinceNearMiss = 0;
    }

    // Boosting is the escape. It runs the PIT clock backwards several times
    // faster than it builds, so one nitro reliably breaks a pursuit that is
    // already closing — without dropping any heat, which stays earned.
    const escaping = state.nitroRemaining > 0 || state.nitroGraceRemaining > 0;

    if (state.stars < HEAT.maxStars) {
      state.secondsAtMaxStars = 0;
    } else if (escaping) {
      const wasClosing = state.secondsAtMaxStars > 0;
      state.secondsAtMaxStars = Math.max(
        0,
        state.secondsAtMaxStars - dt * HEAT.nitroEscapeRate,
      );
      // Boosting the pursuit all the way back to zero *ends* it — a star comes
      // off and the meter starts again. Without this the chase had no
      // resolution: you just boosted every nine seconds forever.
      if (wasClosing && state.secondsAtMaxStars <= 0) {
        state.stars -= 1;
        state.starProgress = 0;
        state.secondsSinceNearMiss = 0;
        state.bustThreat = 0;
        this.observer.onShookOff(state.stars);
      }
    } else {
      state.secondsAtMaxStars += dt;
    }

    const target =
      state.stars >= HEAT.maxStars
        ? clamp01(state.secondsAtMaxStars / HEAT.bustCloseSeconds)
        : 0;
    // Closing in is immediate; backing off is gradual, so the escape reads.
    state.bustThreat =
      target > state.bustThreat
        ? target
        : Math.max(target, state.bustThreat - THREAT_RELIEF_RATE * dt);
  }


  registerNearMiss(state: RunState): void {
    state.secondsSinceNearMiss = 0;
    state.starProgress += this.heatScale;
    if (state.starProgress < HEAT.nearMissesPerStar || state.stars >= HEAT.maxStars) return;

    state.starProgress = 0;
    state.stars += 1;
    state.wantedPeak = Math.max(state.wantedPeak, state.stars);
    this.observer.onStarGained(state.stars);
  }
}
