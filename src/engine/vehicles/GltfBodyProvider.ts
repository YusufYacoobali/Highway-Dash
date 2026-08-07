import { Asset } from 'expo-asset';
import { Box3, Group, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { VehicleSilhouette } from '@/domain/cars';
import type { VehicleBodyProvider, VehicleBodySpec } from '@/engine/types';
import { readAssetArrayBuffer } from './readAssetArrayBuffer';
import { restoreEmbeddedGlbTextures } from './restoreGlbTextures';
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

/** Loads every model in ACTIVE_MODEL_POOL so they can coexist in one run. */
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

          // GLTFLoader's geometry path works in React Native, but embedded GLB
          // images normally go through browser image APIs. Re-upload the baked
          // Meshy texture maps through Expo Asset so they survive on expo-gl.
          await restoreEmbeddedGlbTextures(buffer, gltf.parser, modelId);

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

/**
 * Normalises arbitrary GLBs into engine space. Meshy currently exports these
 * cars with the long axis on X; using a configurable forward axis prevents us
 * from accidentally treating their width as their length again.
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
