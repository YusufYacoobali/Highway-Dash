import { clamp, damp } from '@/core/math';
import type { GameSystem, SystemContext } from '@/engine/types';

const MAX_TILT = 0.42;
const TILT_GAIN = 0.19;
const BODY_FOLLOW_RATE = 13.5;
const ATTRACT_SWAY_AMPLITUDE = 2.4;
const ATTRACT_SWAY_RATE = 0.42;

/** Moves the hero car with exaggerated readable body language at speed. */
export class PlayerSystem implements GameSystem {
  readonly name = 'player';

  update({ state, tuning, player, dt }: SystemContext): void {
    if (state.crashed) return;

    if (state.mode === 'attract') {
      state.x = damp(
        state.x,
        Math.sin(state.elapsed * ATTRACT_SWAY_RATE) * ATTRACT_SWAY_AMPLITUDE,
        1.6,
        dt,
      );
    } else {
      state.x = damp(state.x, state.steerTarget, tuning.steerRate, dt);
    }

    const steeringError = state.steerTarget - state.x;
    const speedWeight = clamp((state.speed - 45) / 75, 0.7, 1.35);
    const tilt = clamp(steeringError * TILT_GAIN * speedWeight, -MAX_TILT, MAX_TILT);
    const nitro = state.nitroRemaining > 0;
    const roadPulse = state.mode === 'run' ? Math.sin(state.elapsed * 14) * 0.012 * speedWeight : 0;

    player.position.x = damp(player.position.x, state.x, BODY_FOLLOW_RATE, dt);
    player.position.y = damp(player.position.y, roadPulse + (nitro ? 0.035 : 0), 10, dt);
    player.rotation.y = -tilt * (state.mode === 'attract' ? 0.4 : 1);
    player.rotation.z = tilt * 0.62;
    player.rotation.x = damp(player.rotation.x, nitro ? -0.055 : 0, 8, dt);
  }

  reset({ player, state }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    player.position.set(0, 0, -2);
    player.rotation.set(0, 0, 0);
    state.x = 0;
    state.steerTarget = 0;
  }
}
