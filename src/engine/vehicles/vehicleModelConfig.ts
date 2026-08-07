import type { VehicleSilhouette } from '@/domain/cars';

/**
 * MODEL TEST SWITCHBOARD
 *
 * For rapid model testing, only edit this file. Metro needs static `require`
 * calls, so every candidate model is registered once in MODEL_LIBRARY and the
 * active mapping below decides which one each engine silhouette uses.
 */
export type VehicleModelId = 'azureVelocity' | 'blueBubble' | 'redBubble';

export interface VehicleModelSpec {
  module: number;
  /** Engine-space length before the global 0.8 vehicle scale is applied. */
  targetLength: number;
  /** Rotate the authored model so its nose faces forward down the highway. */
  yaw: number;
}

export const MODEL_LIBRARY: Record<VehicleModelId, VehicleModelSpec> = {
  azureVelocity: {
    module: require('../../../assets/new-models/Meshy_AI_Azure_Velocity_0807150759_texture.glb'),
    targetLength: 5.2,
    yaw: Math.PI,
  },
  blueBubble: {
    module: require('../../../assets/new-models/Meshy_AI_Blue_Bubble_Car_0807145213_texture.glb'),
    targetLength: 4.9,
    yaw: Math.PI,
  },
  redBubble: {
    module: require('../../../assets/new-models/blue_bubble_car_red.glb'),
    targetLength: 4.9,
    yaw: Math.PI,
  },
};

/**
 * THIS is the main test switch. Change only these values to swap models.
 * All rendered player/traffic GLBs currently come from assets/new-models.
 *
 * Example: set every entry to 'azureVelocity' to stress-test one model only.
 */
export const ACTIVE_VEHICLE_MODEL_MAP: Record<VehicleSilhouette, VehicleModelId> = {
  sports: 'azureVelocity',
  sedan: 'blueBubble',
  hatch: 'redBubble',
  suv: 'blueBubble',
  truck: 'redBubble',
};

/** Keep the authored Meshy materials while evaluating the models. */
export const PRESERVE_AUTHORED_MODEL_COLORS = true;

export const ACTIVE_VEHICLE_SILHOUETTES = Object.keys(
  ACTIVE_VEHICLE_MODEL_MAP,
) as VehicleSilhouette[];

export function activeModelSpec(silhouette: VehicleSilhouette): VehicleModelSpec {
  return MODEL_LIBRARY[ACTIVE_VEHICLE_MODEL_MAP[silhouette]];
}
