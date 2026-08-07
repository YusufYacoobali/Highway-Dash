import { Asset } from 'expo-asset';
import { Box3, Group, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { VehicleSilhouette } from '@/domain/cars';
import type { VehicleBodyProvider, VehicleBodySpec } from '@/engine/types';
import { loadNativeTexture } from './loadNativeTexture';
import { readAssetArrayBuffer } from './readAssetArrayBuffer';
import {
  ACTIVE_MODEL_POOL,
  MODEL_LIBRARY,
  PLAYER_MODEL_ID,
  PRESERVE_AUTHORED_MODEL_COLORS,
  fallbackModelSpec,
  type VehicleForwardAxis,
  type VehicleModelId,
  type VehicleModelSpec,
} from './vehicleModelConfig';

interface PreparedModel {
  prototype: Group;
  length: number;
  width: number;
  paintMaterialName: string | null;
}

/** Loads every active GLB once; runtime clones share its geometry/materials/maps. */
export class GltfBodyProvider implements VehicleBodyProvider {
  readonly id = 'gltf';
  readonly ownsGpuResources = false;

  private constructor(private readonly models: Map<VehicleModelId, PreparedModel>) {}

  static async load(): Promise<GltfBodyProvider | null> {
    const loader = new GLTFLoader();
    const models = new Map<VehicleModelId, PreparedModel>();
    const activeIds = Array.from(new Set<VehicleModelId>([PLAYER_MODEL_ID, ...ACTIVE_MODEL_POOL]));

    await Promise.all(
      activeIds.map(async (modelId) => {
        const spec = MODEL_LIBRARY[modelId];
        try {
          const asset = Asset.fromModule(spec.module);
          const buffer = await readAssetArrayBuffer(asset);
          const gltf = await loader.parseAsync(buffer, '');

          await attachAuthoredTextures(gltf.scene, spec);
          models.set(modelId, prepareModel(gltf.scene, spec));
        } catch (error) {
          console.warn(`[HighwayDash] Failed to load vehicle model: ${modelId}`, error);
        }
      }),
    );

    return models.size === activeIds.length ? new GltfBodyProvider(models) : null;
  }

  dimensions(silhouette: VehicleSilhouette, rawModelId?: string): { length: number; width: number } {
    const modelId = (rawModelId as VehicleModelId | undefined) ?? PLAYER_MODEL_ID;
    const model = this.models.get(modelId);
    const fallback = MODEL_LIBRARY[modelId] ?? fallbackModelSpec(silhouette);
    return model
      ? { length: model.length, width: model.width }
      : { length: fallback.targetLength, width: 2.4 };
  }

  build({ livery, recolor, modelId: rawModelId }: VehicleBodySpec): Group {
    const modelId = (rawModelId as VehicleModelId | undefined) ?? PLAYER_MODEL_ID;
    const model = this.models.get(modelId);
    if (!model) return new Group();

    const clone = model.prototype.clone(true);
    if (!PRESERVE_AUTHORED_MODEL_COLORS && recolor && model.paintMaterialName) {
      repaint(clone, model.paintMaterialName, livery.body);
    }
    return clone;
  }
}

async function attachAuthoredTextures(root: Object3D, spec: VehicleModelSpec): Promise<void> {
  if (!spec.textures?.baseColor) return;

  const baseColor = await loadNativeTexture(spec.textures.baseColor, 'srgb');

  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;

    for (const material of toMaterialArray(mesh.material)) {
      const standard = material as MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) continue;

      // The extracted PNG is the authored colour/albedo. Keep that exact map,
      // but do not use the GLB defaults of metalness=1/roughness=1: with no
      // environment map that makes painted bodywork render almost black.
      standard.map = baseColor;
      standard.color.set(0xffffff);
      standard.metalnessMap = null;
      standard.roughnessMap = null;
      standard.metalness = 0.05;
      standard.roughness = 0.72;
      standard.needsUpdate = true;
    }
  });
}

/**
 * Only spatial normalization remains: centre/ground/scale the untouched model
 * and rotate its authored forward axis onto the road. No mesh or UV edits.
 */
function prepareModel(root: Object3D, spec: VehicleModelSpec): PreparedModel {
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const centre = bounds.getCenter(new Vector3());
  const longitudinalIsX = spec.forwardAxis === '+x' || spec.forwardAxis === '-x';
  const authoredLength = longitudinalIsX ? size.x : size.z;
  const authoredWidth = longitudinalIsX ? size.z : size.x;
  const scale = spec.targetLength / Math.max(0.001, authoredLength);

  root.scale.setScalar(scale);
  root.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);
  root.traverse((node) => {
    if ((node as Mesh).isMesh) node.frustumCulled = true;
  });

  const facing = new Group();
  facing.add(root);
  facing.rotation.y = yawToRoadForward(spec.forwardAxis);

  const prototype = new Group();
  prototype.add(facing);

  return {
    prototype,
    length: spec.targetLength,
    width: authoredWidth * scale,
    paintMaterialName: findPaintMaterialName(root),
  };
}

/** Engine traffic points toward -Z. */
function yawToRoadForward(axis: VehicleForwardAxis): number {
  switch (axis) {
    case '+x':
      return Math.PI / 2;
    case '-x':
      return -Math.PI / 2;
    case '+z':
      return Math.PI;
    case '-z':
      return 0;
  }
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
