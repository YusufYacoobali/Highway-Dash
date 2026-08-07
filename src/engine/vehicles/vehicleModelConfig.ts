import type { VehicleSilhouette } from '@/domain/cars';

/**
 * SINGLE-MODEL PERFORMANCE TEST
 *
 * Raw source GLBs live in assets/new-models. The selected ~30k blue car keeps
 * its geometry/material values/UVs intact. Its embedded image maps are merely
 * extracted as standalone PNGs so Expo GL can upload the exact authored pixels.
 */
export type VehicleModelId = 'blueCompressed';
export type VehicleForwardAxis = '+x' | '-x' | '+z' | '-z';

export interface VehicleTextureModules {
  baseColor?: number;
  metalRough?: number;
}

export interface VehicleModelSpec {
  module: number;
  /** Engine-space length before the global vehicle scale is applied. */
  targetLength: number;
  /** Direction the authored car nose points before engine normalisation. */
  forwardAxis: VehicleForwardAxis;
  /** Exact image maps extracted from the source GLB without repainting/baking. */
  textures?: VehicleTextureModules;
}

export const MODEL_LIBRARY: Record<VehicleModelId, VehicleModelSpec> = {
  blueCompressed: {
    module: require('../../../assets/game-models/Meshy_AI_Blue_Bubble_Car_0807173120_texture.glb'),
    targetLength: 4.9,
    forwardAxis: '-x',
    textures: {
      baseColor: require('../../../assets/game-models/blueCompressed_m0_baseColor.png'),
      metalRough: require('../../../assets/game-models/blueCompressed_m0_metalRough.png'),
    },
  },
};

/** Every traffic spawn resolves to the same compressed blue model. */
export const ACTIVE_MODEL_POOL: readonly VehicleModelId[] = ['blueCompressed'];

/** Player uses the exact same model/prototype as traffic for this test. */
export const PLAYER_MODEL_ID: VehicleModelId = 'blueCompressed';

/** Never apply game livery colours over this authored test material. */
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
