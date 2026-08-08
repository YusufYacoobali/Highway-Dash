import { clamp, clamp01, damp, moveTowards } from '@/core/math';
import { STEER_LIMIT, STEERING } from '@/engine/config';
import type { GameSystem, RunState, SystemContext } from '@/engine/types';
import type { RunTuning } from '@/domain/tuning';

const MAX_TILT = 0.42;
const BODY_FOLLOW_RATE = 13.5;
const ATTRACT_SWAY_AMPLITUDE = 3.9;
const ATTRACT_SWAY_RATE = 0.72;

/**
 * Moves the hero car with exaggerated readable body language at speed.
 *
 * Base steering is a direct, first-order chase of the finger — the car goes
 * where you put it, immediately. Body roll is still driven by the lateral
 * velocity the car actually developed, so it reads as weight without any of
 * that weight being charged to the input.
 *
 * DRIFT MODE swaps in a second-order model with real lateral momentum. It is
 * only ever active for the window granted by a drift gate, because a heavy car
 * is only interesting when the player chose it.
 */
export class PlayerSystem implements GameSystem {
  readonly name = 'player';

  update({ state, tuning, player, dt }: SystemContext): void {
    if (state.crashed) return;

    if (state.mode === 'attract') {
      this.driveAttract(state, dt);
    } else if (state.driftModeRemaining > 0) {
      this.driveDrift(state, tuning, dt);
    } else {
      this.driveDirect(state, tuning, dt);
    }

    const lateral = clamp(state.steerVelocity / Math.max(1, tuning.maxSteerSpeed), -1, 1);
    const speedWeight = clamp((state.speed - 45) / 75, 0.7, 1.35);
    const tilt = clamp(lateral * MAX_TILT * speedWeight, -MAX_TILT, MAX_TILT);
    const nitro = state.nitroRemaining > 0;
    const roadPulse =
      state.mode === 'run'
        ? Math.sin(state.elapsed * 14) * 0.012 * speedWeight
        : Math.sin(state.elapsed * 9) * 0.008;

    player.position.x = damp(player.position.x, state.x, BODY_FOLLOW_RATE, dt);
    player.position.y = damp(player.position.y, roadPulse + (nitro ? 0.045 : 0), 10, dt);
    player.rotation.y = -tilt * (state.mode === 'attract' ? 0.82 : 1);
    player.rotation.z = tilt * (state.mode === 'attract' ? 0.82 : 0.62);
    player.rotation.x = damp(player.rotation.x, nitro ? -0.075 : 0, 8, dt);
  }

  reset({ player, state }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    player.position.set(0, 0, -2);
    player.rotation.set(0, 0, 0);
    state.x = 0;
    state.steerTarget = 0;
    state.steerVelocity = 0;
  }

  private driveAttract(state: RunState, dt: number): void {
    const primary = Math.sin(state.elapsed * ATTRACT_SWAY_RATE) * ATTRACT_SWAY_AMPLITUDE;
    const feint = Math.sin(state.elapsed * 1.85 + 0.7) * 0.72;
    const target = clamp(primary + feint, -4.8, 4.8);
    this.applyDirect(state, target, state.nitroRemaining > 0 ? 5.6 : 3.3, dt);
  }

  /** The default: chase the finger hard, derive velocity for the body roll. */
  private driveDirect(state: RunState, tuning: RunTuning, dt: number): void {
    this.applyDirect(state, state.steerTarget, tuning.steerRate, dt);
  }

  private applyDirect(state: RunState, target: number, rate: number, dt: number): void {
    const previousX = state.x;
    state.x = clamp(damp(state.x, target, rate, dt), -STEER_LIMIT, STEER_LIMIT);
    state.steerVelocity = dt > 0 ? (state.x - previousX) / dt : 0;
  }

  private driveDrift(state: RunState, tuning: RunTuning, dt: number): void {
    const { drift } = STEERING;
    // Grip washes out with speed, so the same flick that threads a gap at
    // 200 km/h runs wide under nitro. Drift mode is meant to cost something.
    const gripFactor = 1 - drift.highSpeedGripLoss * clamp01(state.speed / drift.gripLossSpeed);
    const maxSpeed = Math.min(tuning.maxSteerSpeed, drift.maxSpeed) * gripFactor;

    const error = state.steerTarget - state.x;
    const desired = clamp(error * drift.gain, -maxSpeed, maxSpeed);

    // Turning in commits; easing off coasts. Braking the lateral velocity
    // harder than it was built would read as the car snapping straight.
    const easingOff = Math.abs(desired) < Math.abs(state.steerVelocity);
    const accel = (easingOff ? drift.releaseDamping : tuning.steerAccel * gripFactor) * dt;

    state.steerVelocity = moveTowards(state.steerVelocity, desired, accel);
    state.x += state.steerVelocity * dt;

    if (state.x <= -STEER_LIMIT || state.x >= STEER_LIMIT) {
      state.x = clamp(state.x, -STEER_LIMIT, STEER_LIMIT);
      state.steerVelocity *= STEERING.wallBounce;
    }
  }
}
