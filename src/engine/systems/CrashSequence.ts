import type { PerspectiveCamera } from 'three';

import { clamp01, damp, randomRange, randomSign } from '@/core/math';
import { CAMERA, CRASH } from '@/engine/config';
import type { SystemContext, VehicleObject } from '@/engine/types';

const CAMERA_PUNCH_SECONDS = 0.75;
const HIT_STOP_SECONDS = 0.09;
const SPEED_BLEED = 38;
const GRAVITY = 24;

/** Cinematic slow-motion impact/tumble sequence. */
export class CrashSequence {
  private elapsed = 0;
  private spin = 0;
  private pitch = 0;
  private verticalVelocity = 0;
  private lateralVelocity = 0;
  private reported = false;

  constructor(private readonly camera: PerspectiveCamera) {}

  begin(state: SystemContext['state']): void {
    this.elapsed = 0;
    this.reported = false;
    this.spin = randomSign() * randomRange(CRASH.spinMin, CRASH.spinMax);
    this.pitch = randomSign() * randomRange(1.8, 3.4);
    this.verticalVelocity = randomRange(CRASH.liftMin, CRASH.liftMax);
    this.lateralVelocity = randomSign() * randomRange(2.2, 4.2);
    state.crashed = true;
    state.cameraShake = 3.8;
  }

  /** Slow-motion factor applied to the rest of the world this frame. */
  get slowFactor(): number {
    if (this.elapsed < HIT_STOP_SECONDS) return 0.025;
    return Math.max(0.14, 1 - (this.elapsed - HIT_STOP_SECONDS) * 1.25);
  }

  /** True on the single frame the run summary should be handed to the UI. */
  update(state: SystemContext['state'], player: VehicleObject, dt: number): boolean {
    this.elapsed += dt;
    const slow = this.slowFactor;

    state.speed = Math.max(0, state.speed - dt * SPEED_BLEED);
    state.cameraShake = Math.max(0, state.cameraShake - dt * 3.1);

    this.tumble(player, dt, slow);
    this.frameWreck(state, player, dt);

    if (this.elapsed > CRASH.reportDelay && !this.reported) {
      this.reported = true;
      return true;
    }
    return false;
  }

  private tumble(player: VehicleObject, dt: number, slow: number): void {
    // The first few frames almost freeze on impact, then the car releases into
    // a readable roll/pitch rather than instantly pinwheeling off screen.
    const motion = this.elapsed < HIT_STOP_SECONDS ? 0.08 : slow;
    player.rotation.y += this.spin * dt * motion * 1.9;
    player.rotation.z += this.spin * dt * motion * 1.25;
    player.rotation.x += this.pitch * dt * motion;

    this.verticalVelocity -= GRAVITY * dt;
    player.position.y += this.verticalVelocity * dt * Math.max(0.35, motion);
    player.position.x += this.lateralVelocity * dt * motion;
    player.position.z += 6.2 * dt * motion;

    if (player.position.y <= 0) {
      player.position.y = 0;
      if (this.verticalVelocity < -2.5 && this.elapsed < 1.15) {
        this.verticalVelocity = -this.verticalVelocity * 0.3;
        this.spin *= 0.78;
        this.pitch *= 0.72;
      } else {
        this.verticalVelocity = 0;
      }
    }
  }

  private frameWreck(
    state: SystemContext['state'],
    player: VehicleObject,
    dt: number,
  ): void {
    const k = clamp01(this.elapsed / CAMERA_PUNCH_SECONDS);
    const shakeStrength = state.cameraShake * (1 - k * 0.65);
    const shakeX = (Math.random() - 0.5) * shakeStrength;
    const shakeY = (Math.random() - 0.5) * shakeStrength * 0.35;

    this.camera.position.x =
      damp(this.camera.position.x, player.position.x * 0.82, 7, dt) + shakeX;
    this.camera.position.y = CAMERA.height - 2.7 * k + shakeY;
    this.camera.position.z = CAMERA.distance - 6.5 * k;
    this.camera.lookAt(
      player.position.x * 0.72,
      1.05 + player.position.y * 0.55,
      player.position.z - 3.2,
    );

    // Lens punches in hard on impact, then relaxes toward the normal FOV.
    const targetFov = 50 + 12 * k;
    this.camera.fov = damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();
  }
}
