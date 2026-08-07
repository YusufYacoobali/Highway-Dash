import { clamp, damp } from '@/core/math';
import type { GameSystem, SystemContext } from '@/engine/types';

const MAX_TILT = 0.3;
const TILT_GAIN = 0.16;
const BODY_FOLLOW_RATE = 12;
const ATTRACT_SWAY_AMPLITUDE = 2.4;
const ATTRACT_SWAY_RATE = 0.42;

/** Moves the hero car. Steering is one continuous axis rather than lane snapping. */
export class PlayerSystem implements GameSystem {
  readonly name = 'player';

  update({ state, tuning, player, dt }: SystemContext): void {
    // CrashSequence owns the full player transform while wrecking. Running the
    // normal steering system here used to overwrite its spin/roll every frame.
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

    const tilt = clamp((state.steerTarget - state.x) * TILT_GAIN, -MAX_TILT, MAX_TILT);
    player.position.x = damp(player.position.x, state.x, BODY_FOLLOW_RATE, dt);
    player.rotation.y = -tilt * (state.mode === 'attract' ? 0.4 : 1);
    player.rotation.z = tilt * 0.5;
  }

  reset({ player, state }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    player.position.set(0, 0, -2);
    player.rotation.set(0, 0, 0);
    state.x = 0;
    state.steerTarget = 0;
  }
}
