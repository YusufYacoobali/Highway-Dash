import { clamp } from '@/core/math';
import { GATE, SCORING } from '@/engine/config';
import type { GameSystem, RunState, SystemContext } from '@/engine/types';

/**
 * Owns the combo economy, the risk multiplier and the headline score.
 *
 * Distance measures survival, which a player can maximise by sitting in an
 * empty lane. Score measures risk: metres are banked at whatever multiplier
 * the chain is holding, so the gap between two trucks is worth many times the
 * same stretch of open road. The multiplier drains rather than snapping back
 * to 1, which turns the end of every chain into a visible countdown the player
 * can choose to fight.
 */
export class ScoreSystem implements GameSystem {
  readonly name = 'score';

  /**
   * Mirrored from the tuning each tick so the reward callbacks — which are
   * fired by other systems and never see a `SystemContext` — still honour the
   * daily modifier.
   */
  private coinScale = 1;

  reset({ tuning }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    this.coinScale = tuning.coinScale;
  }

  update({ state, tuning, dt }: SystemContext): void {
    if (state.mode !== 'run' || state.crashed) return;
    this.coinScale = tuning.coinScale;

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    } else if (state.multiplier > SCORING.multiplierMin) {
      state.multiplier = Math.max(
        SCORING.multiplierMin,
        state.multiplier - SCORING.multiplierDecayRate * dt,
      );
    }

    if (!state.started) return;

    const gateScale =
      state.gateBoostRemaining <= 0
        ? 1
        : state.gateKind === 'drift'
          ? GATE.driftScoreScale
          : GATE.doubleScoreScale;
    state.score +=
      state.speed *
      dt *
      SCORING.scorePerMetre *
      state.multiplier *
      tuning.scoreScale *
      gateScale;
  }

  registerNearMiss(state: RunState): void {
    state.nearMisses += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboTimer = SCORING.comboWindow;
    state.secondsSinceNearMiss = 0;
    state.cameraShake = Math.max(state.cameraShake, state.combo >= 10 ? 0.85 : 0.5);
    this.award(state, SCORING.nearMissCoins + Math.floor(state.combo / 2));
    this.addMultiplier(state, SCORING.multiplierPerNearMiss);
  }

  registerRam(state: RunState): void {
    state.combo += 2;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboTimer = SCORING.comboWindow + 0.75;
    const chainBonus = Math.min(24, state.nitroSmashes * 3);
    this.award(state, 8 + chainBonus + Math.floor(state.combo / 2));
    this.addMultiplier(state, SCORING.multiplierPerRam);
  }

  registerCoins(state: RunState, value: number): void {
    this.award(state, value);
    // Coins nudge the chain along so a Coin Rush is not a dead multiplier zone,
    // but never enough to build one on their own.
    if (state.comboTimer > 0) this.addMultiplier(state, SCORING.multiplierPerCoin);
  }

  /** A completed slipstream: chain fuel, coins, and a reason to tailgate. */
  registerDraft(state: RunState, coins: number, multiplierBonus: number): void {
    state.drafts += 1;
    this.award(state, coins);
    this.addMultiplier(state, multiplierBonus);
    state.comboTimer = Math.max(state.comboTimer, SCORING.comboWindow);
  }

  registerGate(state: RunState, risky: boolean): void {
    if (risky) {
      this.addMultiplier(state, GATE.riskMultiplierBonus);
      state.comboTimer = Math.max(state.comboTimer, SCORING.comboWindow);
      return;
    }
    this.award(state, GATE.safeCoins);
  }

  private award(state: RunState, coins: number): void {
    state.coins += Math.round(coins * this.coinScale);
  }

  /** A scrape costs most of the chain but never all of it. */
  registerSideswipe(state: RunState): void {
    state.sideswipes += 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = Math.max(
      SCORING.multiplierMin,
      SCORING.multiplierMin +
        (state.multiplier - SCORING.multiplierMin) * SCORING.sideswipeMultiplierKeep,
    );
  }

  private addMultiplier(state: RunState, amount: number): void {
    state.multiplier = clamp(
      state.multiplier + amount,
      SCORING.multiplierMin,
      SCORING.multiplierMax,
    );
    state.bestMultiplier = Math.max(state.bestMultiplier, state.multiplier);
  }
}
