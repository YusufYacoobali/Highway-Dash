import type { VehicleSilhouette } from '@/domain/cars';

/**
 * Static `require` calls are mandatory — Metro resolves asset modules at build
 * time, so the paths cannot be constructed dynamically.
 */
export const VEHICLE_MODEL_MODULES: Record<VehicleSilhouette, number> = {
  sports: require('../../../assets/models/player_sports_car.glb'),
  sedan: require('../../../assets/models/traffic_sedan_blue.glb'),
  hatch: require('../../../assets/models/traffic_hatchback_teal.glb'),
  suv: require('../../../assets/models/traffic_suv_yellow.glb'),
  truck: require('../../../assets/models/traffic_box_truck.glb'),
};

export const VEHICLE_SILHOUETTES = Object.keys(VEHICLE_MODEL_MODULES) as VehicleSilhouette[];
