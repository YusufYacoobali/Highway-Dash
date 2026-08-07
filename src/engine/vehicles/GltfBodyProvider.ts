import { Asset } from 'expo-asset';
import { Box3, Group, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { VehicleSilhouette } from '@/domain/cars';
import type { VehicleBodyProvider, VehicleBodySpec } from '@/engine/types';
import { readAssetArrayBuffer } from './readAssetArrayBuffer';
import {
  ACTIVE_VEHICLE_MODEL_MAP,
  ACTIVE_VEHICLE_SILHOUETTES,
  MODEL_LIBRARY,
  PRESERVE_AUTHORED_MODEL_COLORS,
  activeModelSpec,
  type VehicleModelId,
  type VehicleModelSpec,
} from './vehicleModelConfig';

interface PreparedModel {
  prototype: Group;
  length: number;
  width: number;
  paintMaterialName: string | null;
}

/** Loads only the models selected in vehicleModelConfig.ts. */
export class GltfBodyProvider implements VehicleBodyProvider {
  readonly id = 'gltf';
  readonly ownsGpuResources = false;

  private constructor(private readonly models: Map<VehicleSilhouette, PreparedModel>) {}

  static async load(): Promise<GltfBodyProvider | null> {
    const loader = new GLTFLoader();
    const preparedById = new Map<VehicleModelId, PreparedModel>();
    const activeIds = Array.from(
      new Set(Object.values(ACTIVE_VEHICLE_MODEL_MAP) as VehicleModelId[]),
    );

    await Promise.all(
      activeIds.map(async (modelId) => {
        const spec = MODEL_LIBRARY[modelId];
        try {
          const asset = Asset.fromModule(spec.module);
          const buffer = await readAssetArrayBuffer(asset);
          const gltf = await loader.parseAsync(buffer, '');
          preparedById.set(modelId, prepareModel(gltf.scene, spec));
        } catch (error) {
          console.warn(`[HighwayDash] Failed to load vehicle model: ${modelId}`, error);
        }
      }),
    );

    const models = new Map<VehicleSilhouette, PreparedModel>();
    for (const silhouette of ACTIVE_VEHICLE_SILHOUETTES) {
      const modelId = ACTIVE_VEHICLE_MODEL_MAP[silhouette];
      const prepared = preparedById.get(modelId);
      if (prepared) models.set(silhouette, prepared);
    }

    return models.size === ACTIVE_VEHICLE_SILHOUETTES.length
      ? new GltfBodyProvider(models)
      : null;
  }

  dimensions(silhouette: VehicleSilhouette): { length: number; width: number } {
    const model = this.models.get(silhouette);
    const fallback = activeModelSpec(silhouette);
    return model
      ? { length: model.length, width: model.width }
      : { length: fallback.targetLength, width: 2.4 };
  }

  build({ silhouette, livery, recolor }: VehicleBodySpec): Group {
    const model = this.models.get(silhouette);
    if (!model) return new Group();

    const clone = model.prototype.clone(true);
    if (!PRESERVE_AUTHORED_MODEL_COLORS && recolor && model.paintMaterialName) {
      repaint(clone, model.paintMaterialName, livery.body);
    }
    return clone;
  }
}

/** Normalise arbitrary test GLBs into the same engine coordinate space. */
function prepareModel(root: Object3D, spec: VehicleModelSpec): PreparedModel {
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const centre = bounds.getCenter(new Vector3());

  const scale = spec.targetLength / Math.max(0.001, size.z);
  root.scale.setScalar(scale);
  root.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);
  root.traverse((node) => {
    if ((node as Mesh).isMesh) node.frustumCulled = true;
  });

  const facing = new Group();
  facing.add(root);
  facing.rotation.y = spec.yaw;

  const prototype = new Group();
  prototype.add(facing);

  return {
    prototype,
    length: spec.targetLength,
    width: size.x * scale,
    paintMaterialName: findPaintMaterialName(root),
  };
}

function findPaintMaterialName(root: Object3D): string | null {
  const weights = new Map<string, number>();

  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const count = mesh.geometry.attributes.position?.count ?? 0;
    for (const material of toMaterialArray(mesh.material)) {
      if (!material.name) continue;
      weights.set(material.name, (weights.get(material.name) ?? 0) + count);
    }
  });

  let best: string | null = null;
  let bestWeight = 0;
  for (const [name, weight] of weights) {
    if (weight > bestWeight) {
      best = name;
      bestWeight = weight;
    }
  }
  return best;
}

function repaint(root: Object3D, materialName: string, color: string): void {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;

    const materials = toMaterialArray(mesh.material);
    const repainted = materials.map((material) => {
      if (material.name !== materialName) return material;
      const copy = material.clone() as MeshStandardMaterial;
      copy.color?.set(color);
      copy.userData.disposable = true;
      return copy;
    });

    mesh.material = Array.isArray(mesh.material) ? repainted : repainted[0];
  });
}

function toMaterialArray(material: Material | Material[]): Material[] {
  return Array.isArray(material) ? material : [material];
}
