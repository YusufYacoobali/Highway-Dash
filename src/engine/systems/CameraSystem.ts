import type { PerspectiveCamera } from 'three';

import { clamp, damp } from '@/core/math';
import { CAMERA, SCORING } from '@/engine/config';
import type { GameSystem, SystemContext } from '@/engine/types';

const SHAKE_DECAY = 1.6;
const FOV_RATE = 3;
/** Above this speed the FOV starts creeping open for a sense of rush. */
const FOV_SPEED_FLOOR_KMH = 120;
const MAX_SPEED_FOV_BOOST = 8;

/**
 * Chase camera. Nitro widens the lens and shoves the camera back — the single
 * most important piece of game feel in the whole build, and the reason this is
 * a system rather than a couple of lines in the render loop.
 */
export class CameraSystem implements GameSystem {
  readonly name = 'camera';

  constructor(private readonly camera: PerspectiveCamera) {}

  update({ state, player, dt }: SystemContext): void {
    const shake = state.cameraShake > 0 ? (Math.random() - 0.5) * state.cameraShake : 0;
    state.cameraShake = Math.max(0, state.cameraShake - dt * SHAKE_DECAY);

    const targetX = player.position.x * CAMERA.followFactor + shake;
    this.camera.position.x = damp(this.camera.position.x, targetX, CAMERA.followRate, dt);
    this.camera.position.y = CAMERA.height + (state.mode === 'attract' ? 0.6 : 0);
    this.camera.position.z = CAMERA.distance + (state.nitroRemaining > 0 ? CAMERA.nitroPullback : 0);
    this.camera.lookAt(player.position.x * 0.35, 1.1, -20);

    const kmh = state.speed * SCORING.speedToKmh;
    const targetFov =
      CAMERA.fov +
      (state.nitroRemaining > 0 ? CAMERA.nitroFovBoost : 0) +
      clamp((kmh - FOV_SPEED_FLOOR_KMH) / 22, 0, MAX_SPEED_FOV_BOOST);

    this.camera.fov = damp(this.camera.fov, targetFov, FOV_RATE, dt);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.camera.position.set(0, CAMERA.height, CAMERA.distance);
    this.camera.fov = CAMERA.fov;
    this.camera.updateProjectionMatrix();
  }
}
