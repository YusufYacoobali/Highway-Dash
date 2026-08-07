import { SCORING } from '@/engine/config';
import type { GameSystem, SystemContext } from '@/engine/types';

/** Owns the combo economy and short-term reward loop. */
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
    state.cameraShake = Math.max(state.cameraShake, state.combo >= 10 ? 0.85 : 0.5);
    state.coins += SCORING.nearMissCoins + Math.floor(state.combo / 2);
  }

  registerRam(state: SystemContext['state']): void {
    state.combo += 2;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboTimer = SCORING.comboWindow + 0.75;
    const chainBonus = Math.min(24, state.nitroSmashes * 3);
    state.coins += 8 + chainBonus + Math.floor(state.combo / 2);
  }

  registerCoins(state: SystemContext['state'], value: number): void {
    state.coins += value;
  }
}
