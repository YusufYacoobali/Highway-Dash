import type { VehicleSilhouette } from '@/domain/cars';

/**
 * SINGLE-MODEL PERFORMANCE TEST
 *
 * Raw source GLBs live in assets/new-models. The game loads the optimized
 * assets/game-models version produced by scripts/optimize-vehicle-models.mjs.
 * For this test, player + every traffic vehicle use the same ~30k blue car so
 * all runtime copies share one loaded prototype, geometry set and material set.
 */
export type VehicleModelId = 'blueCompressed';
export type VehicleForwardAxis = '+x' | '-x' | '+z' | '-z';

export interface VehicleModelSpec {
  module: number;
  /** Engine-space length before the global vehicle scale is applied. */
  targetLength: number;
  /** Direction the authored car nose points before engine normalisation. */
  forwardAxis: VehicleForwardAxis;
}

export const MODEL_LIBRARY: Record<VehicleModelId, VehicleModelSpec> = {
  blueCompressed: {
    module: require('../../../assets/game-models/Meshy_AI_Blue_Bubble_Car_0807173120_texture.glb'),
    targetLength: 4.9,
    forwardAxis: '-x',
  },
};

/** Every traffic spawn resolves to the same compressed blue model. */
export const ACTIVE_MODEL_POOL: readonly VehicleModelId[] = ['blueCompressed'];

/** Player uses the exact same model/prototype as traffic for this test. */
export const PLAYER_MODEL_ID: VehicleModelId = 'blueCompressed';

/** Optimized GLB contains its authored appearance as baked vertex colours. */
export const PRESERVE_AUTHORED_MODEL_COLORS = true;

export function activeModelIdAt(_index: number): VehicleModelId {
  return PLAYER_MODEL_ID;
}

export function modelSpec(modelId: VehicleModelId): VehicleModelSpec {
  return MODEL_LIBRARY[modelId];
}

/** Procedural fallback still asks by silhouette; use the same test model size. */
export function fallbackModelSpec(_silhouette: VehicleSilhouette): VehicleModelSpec {
  return MODEL_LIBRARY[PLAYER_MODEL_ID];
}
