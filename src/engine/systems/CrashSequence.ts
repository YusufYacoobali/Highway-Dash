import type { PerspectiveCamera } from 'three';

import { clamp01, damp, randomRange, randomSign } from '@/core/math';
import { CAMERA, CRASH } from '@/engine/config';
import type { SystemContext, VehicleObject } from '@/engine/types';

/** How far into the sequence the camera finishes its punch-in. */
const CAMERA_PUNCH_SECONDS = 0.9;
const CRASH_FOV = 78;
const SPEED_BLEED = 34;

/**
 * The slow-motion tumble. It runs instead of the normal simulation, which is
 * why it is a sequence with its own clock rather than a `GameSystem` — the
 * player has no agency here, so nothing else should be ticking.
 */
export class CrashSequence {
  private elapsed = 0;
  private spin = 0;
  private lift = 0;
  private reported = false;

  constructor(private readonly camera: PerspectiveCamera) {}

  begin(state: SystemContext['state']): void {
    this.elapsed = 0;
    this.reported = false;
    this.spin = randomSign() * randomRange(CRASH.spinMin, CRASH.spinMax);
    this.lift = randomRange(CRASH.liftMin, CRASH.liftMax);
    state.crashed = true;
    state.cameraShake = 3.2;
  }

  /** Slow-motion factor applied to the rest of the world this frame. */
  get slowFactor(): number {
    return Math.max(0.12, 1 - this.elapsed * 1.5);
  }

  /** True on the single frame the run summary should be handed to the UI. */
  update(state: SystemContext['state'], player: VehicleObject, dt: number): boolean {
    this.elapsed += dt;
    const slow = this.slowFactor;

    state.speed = Math.max(0, state.speed - dt * SPEED_BLEED);
    state.cameraShake = Math.max(0, state.cameraShake - dt * 2.2);

    this.tumble(player, dt, slow);
    this.frameWreck(player, dt);

    if (this.elapsed > CRASH.reportDelay && !this.reported) {
      this.reported = true;
      return true;
    }
    return false;
  }

  private tumble(player: VehicleObject, dt: number, slow: number): void {
    player.rotation.y += this.spin * dt * slow * 2.4;
    player.rotation.z += this.spin * dt * slow * 1.1;
    // Ballistic arc: constant lift minus an accelerating fall.
    player.position.y = Math.max(
      0,
      player.position.y + (this.lift * dt - this.elapsed * this.elapsed * 7 * dt) * 3.4,
    );
    player.position.z += 5.5 * dt * slow;
    player.position.x += this.spin * 0.35 * dt;
  }

  private frameWreck(player: VehicleObject, dt: number): void {
    const k = clamp01(this.elapsed / CAMERA_PUNCH_SECONDS);

    this.camera.position.x = damp(this.camera.position.x, player.position.x * 0.8, 5, dt);
    this.camera.position.y = CAMERA.height - 3.1 * k;
    this.camera.position.z = CAMERA.distance - 5.4 * k;
    this.camera.lookAt(player.position.x * 0.6, 1.1 + player.position.y * 0.5, player.position.z - 4);
    this.camera.fov = damp(this.camera.fov, CRASH_FOV - 16 * k, 4, dt);
    this.camera.updateProjectionMatrix();
  }
}
