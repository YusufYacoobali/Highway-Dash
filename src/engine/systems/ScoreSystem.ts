import { SCORING } from '@/engine/config';
import type { GameSystem, SystemContext } from '@/engine/types';

/**
 * Owns the combo economy: how long a combo survives, what a near-miss pays and
 * how the run's headline numbers accumulate. Keeping this separate from the
 * traffic geometry means the reward curve can be retuned without touching
 * anything that moves.
 */
export class ScoreSystem implements GameSystem {
  readonly name = 'score';

  update({ state, dt }: SystemContext): void {
    if (state.comboTimer <= 0) return;

    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  registerNearMiss(state: SystemContext['state']): void {
    state.nearMisses += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboTimer = SCORING.comboWindow;
    state.secondsSinceNearMiss = 0;
    state.cameraShake = 0.5;
    state.coins += SCORING.nearMissCoins + Math.floor(state.combo / 3);
  }

  registerCoins(state: SystemContext['state'], value: number): void {
    state.coins += value;
  }
}
