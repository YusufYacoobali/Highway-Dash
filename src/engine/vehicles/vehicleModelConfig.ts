import type { VehicleSilhouette } from '@/domain/cars';

/**
 * SINGLE-MODEL PERFORMANCE TEST
 *
 * Raw source GLBs live in assets/new-models. The selected ~30k blue car keeps
 * its geometry and UVs intact. `scripts/optimize-vehicle-models.mjs` lifts the
 * embedded maps out of the GLB, and `scripts/build-vehicle-raw-textures.mjs`
 * pre-decodes the base colour into an RGBA blob so the runtime never depends on
 * native image decoding (see `loadNativeTexture`).
 */
export type VehicleModelId = 'blueCompressed';
export type VehicleForwardAxis = '+x' | '-x' | '+z' | '-z';

export interface VehicleTextureModules {
  /** Pre-decoded RGBA blob, not a PNG. */
  baseColor?: number;
}

/**
 * Replaces the stripped metallicRoughness map with the constants it averaged
 * out to. Leaving these unset is not an option: glTF defaults metallic to 1.0,
 * and a fully metallic surface with no environment map reflects nothing and
 * renders black.
 */
export interface VehicleSurfaceFinish {
  metalness: number;
  roughness: number;
  /** Shown if the base colour blob fails to load, so a fault never reads as black. */
  fallbackColor: string;
}

export interface VehicleModelSpec {
  module: number;
  /** Engine-space length before the global vehicle scale is applied. */
  targetLength: number;
  /** Direction the authored car nose points before engine normalisation. */
  forwardAxis: VehicleForwardAxis;
  /** Authored maps lifted out of the source GLB, without repainting/baking. */
  textures?: VehicleTextureModules;
  finish: VehicleSurfaceFinish;
}

export const MODEL_LIBRARY: Record<VehicleModelId, VehicleModelSpec> = {
  blueCompressed: {
    module: require('../../../assets/game-models/Meshy_AI_Blue_Bubble_Car_0807173120_texture.glb'),
    targetLength: 4.9,
    forwardAxis: '-x',
    textures: {
      baseColor: require('../../../assets/game-models/blueCompressed_m0_baseColor.rgba.bin'),
    },
    // Averaged from the authored metallicRoughness map (metallic 0.04,
    // roughness 0.27); nudged rougher so the single directional light does not
    // collapse the whole body into one hard highlight.
    finish: { metalness: 0.05, roughness: 0.45, fallbackColor: '#3a5991' },
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
