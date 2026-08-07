// Compatibility shim: model selection now lives in vehicleModelConfig.ts.
// Keep this file so any older imports/tests have one obvious migration path.
export {
  ACTIVE_VEHICLE_MODEL_MAP,
  ACTIVE_VEHICLE_SILHOUETTES,
  MODEL_LIBRARY,
  PRESERVE_AUTHORED_MODEL_COLORS,
  activeModelSpec,
} from './vehicleModelConfig';
export type { VehicleModelId, VehicleModelSpec } from './vehicleModelConfig';
