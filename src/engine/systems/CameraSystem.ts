import type { PerspectiveCamera } from 'three';

import { clamp, damp } from '@/core/math';
import { CAMERA, SCORING } from '@/engine/config';
import type { GameSystem, SystemContext } from '@/engine/types';

const SHAKE_DECAY = 2.05;
const FOV_RATE = 4.1;
const FOV_SPEED_FLOOR_KMH = 125;
const MAX_SPEED_FOV_BOOST = 9;

/** Chase camera that visibly changes gear with the run director. */
export class CameraSystem implements GameSystem {
  readonly name = 'camera';

  constructor(private readonly camera: PerspectiveCamera) {}

  update({ state, player, dt }: SystemContext): void {
    if (state.crashed) return;

    const shake = state.cameraShake > 0 ? (Math.random() - 0.5) * state.cameraShake : 0;
    state.cameraShake = Math.max(0, state.cameraShake - dt * SHAKE_DECAY);

    const tunnelDrop = state.theme === 'tunnel' ? -0.72 : state.theme === 'night' ? -0.18 : 0;
    const targetX = player.position.x * CAMERA.followFactor + shake;
    this.camera.position.x = damp(this.camera.position.x, targetX, CAMERA.followRate, dt);
    this.camera.position.y = CAMERA.height + tunnelDrop + (state.mode === 'attract' ? 0.6 : 0);
    this.camera.position.z =
      CAMERA.distance +
      (state.nitroRemaining > 0 ? CAMERA.nitroPullback : 0) +
      state.intensity * 0.42;
    this.camera.lookAt(player.position.x * 0.35, 1.05, -20 - state.intensity * 3.5);

    const kmh = state.speed * SCORING.speedToKmh;
    const slowMoPunch = state.slowMoRemaining > 0 ? -3.5 : 0;
    const targetFov =
      CAMERA.fov +
      (state.nitroRemaining > 0 ? CAMERA.nitroFovBoost : 0) +
      clamp((kmh - FOV_SPEED_FLOOR_KMH) / 22, 0, MAX_SPEED_FOV_BOOST) +
      state.intensity * 2.8 +
      slowMoPunch;

    this.camera.fov = damp(this.camera.fov, targetFov, FOV_RATE, dt);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.camera.position.set(0, CAMERA.height, CAMERA.distance);
    this.camera.fov = CAMERA.fov;
    this.camera.updateProjectionMatrix();
  }
}
