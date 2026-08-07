import type { VehicleSilhouette } from '@/domain/cars';

/**
 * MODEL TEST SWITCHBOARD
 *
 * Raw source GLBs live in assets/new-models. The game loads the optimized
 * assets/game-models versions produced by scripts/optimize-vehicle-models.mjs.
 * Every active model is used together in traffic.
 */
export type VehicleModelId = 'azureVelocity' | 'blueBubble' | 'redBubble';
export type VehicleForwardAxis = '+x' | '-x' | '+z' | '-z';

export interface VehicleModelSpec {
  module: number;
  /** Engine-space length before the global vehicle scale is applied. */
  targetLength: number;
  /** Direction the authored car nose points before engine normalisation. */
  forwardAxis: VehicleForwardAxis;
}

export const MODEL_LIBRARY: Record<VehicleModelId, VehicleModelSpec> = {
  azureVelocity: {
    module: require('../../../assets/game-models/Meshy_AI_Azure_Velocity_0807150759_texture.glb'),
    targetLength: 5.2,
    forwardAxis: '-x',
  },
  blueBubble: {
    module: require('../../../assets/game-models/Meshy_AI_Blue_Bubble_Car_0807145213_texture.glb'),
    targetLength: 4.9,
    forwardAxis: '-x',
  },
  redBubble: {
    module: require('../../../assets/game-models/blue_bubble_car_red.glb'),
    targetLength: 4.9,
    forwardAxis: '-x',
  },
};

/** Every id here appears together in traffic. */
export const ACTIVE_MODEL_POOL: readonly VehicleModelId[] = [
  'azureVelocity',
  'blueBubble',
  'redBubble',
];

/** Player car for this temporary model-testing setup. */
export const PLAYER_MODEL_ID: VehicleModelId = 'azureVelocity';

/** Optimized GLBs already contain their authored appearance as vertex colours. */
export const PRESERVE_AUTHORED_MODEL_COLORS = true;

export function activeModelIdAt(index: number): VehicleModelId {
  return ACTIVE_MODEL_POOL[index % ACTIVE_MODEL_POOL.length] ?? PLAYER_MODEL_ID;
}

export function modelSpec(modelId: VehicleModelId): VehicleModelSpec {
  return MODEL_LIBRARY[modelId];
}

/** Procedural fallback still asks by silhouette; give it a sensible test size. */
export function fallbackModelSpec(_silhouette: VehicleSilhouette): VehicleModelSpec {
  return MODEL_LIBRARY[PLAYER_MODEL_ID];
}
