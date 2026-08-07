import type { Object3D } from 'three';

/**
 * A repeating strip of scenery. Rather than streaming geometry, a fixed set of
 * objects is recycled: once one passes the camera it jumps back by exactly one
 * period, which keeps the draw call count constant for the whole run.
 */
export interface ScrollBand {
  readonly objects: readonly Object3D[];
  /** Distance to subtract when an object wraps — one full period. */
  readonly period: number;
  /** Z beyond which an object is considered behind the camera. */
  readonly threshold: number;
  /** Optional re-randomisation so wrapping is not visually periodic. */
  readonly onWrap?: (object: Object3D) => void;
}

export function scrollBand(band: ScrollBand, distance: number): void {
  for (const object of band.objects) {
    object.position.z += distance;
    if (object.position.z > band.threshold) {
      object.position.z -= band.period;
      band.onWrap?.(object);
    }
  }
}
