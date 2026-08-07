import { Asset } from 'expo-asset';
import { Box3, Group, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { VehicleSilhouette } from '@/domain/cars';
import { VEHICLE_LENGTH } from '@/engine/config';
import type { VehicleBodyProvider, VehicleBodySpec } from '@/engine/types';
import { readAssetArrayBuffer } from './readAssetArrayBuffer';
import { VEHICLE_MODEL_MODULES, VEHICLE_SILHOUETTES } from './modelManifest';

interface PreparedModel {
  prototype: Group;
  length: number;
  width: number;
  /** Material carrying the largest share of the mesh — the car's paint. */
  paintMaterialName: string | null;
}

/**
 * Renders vehicles from the low-poly glTF pack. Construction is asynchronous
 * and failure-tolerant: {@link GltfBodyProvider.load} resolves to `null` when
 * the models cannot be decoded, and the caller keeps using the procedural
 * bodies instead of crashing.
 */
export class GltfBodyProvider implements VehicleBodyProvider {
  readonly id = 'gltf';
  /** Bodies are `clone(true)` of a prototype and share its buffers. */
  readonly ownsGpuResources = false;

  private constructor(private readonly models: Map<VehicleSilhouette, PreparedModel>) {}

  static async load(): Promise<GltfBodyProvider | null> {
    const loader = new GLTFLoader();
    const models = new Map<VehicleSilhouette, PreparedModel>();

    await Promise.all(
      VEHICLE_SILHOUETTES.map(async (silhouette) => {
        try {
          const asset = Asset.fromModule(VEHICLE_MODEL_MODULES[silhouette]);
          const buffer = await readAssetArrayBuffer(asset);
          const gltf = await loader.parseAsync(buffer, '');
          models.set(silhouette, prepareModel(gltf.scene, VEHICLE_LENGTH[silhouette]));
        } catch {
          // A missing silhouette falls back to the procedural body for that
          // vehicle only; the rest of the pack still renders.
        }
      }),
    );

    return models.size === VEHICLE_SILHOUETTES.length ? new GltfBodyProvider(models) : null;
  }

  dimensions(silhouette: VehicleSilhouette): { length: number; width: number } {
    const model = this.models.get(silhouette);
    return model
      ? { length: model.length, width: model.width }
      : { length: VEHICLE_LENGTH[silhouette], width: 2.5 };
  }

  build({ silhouette, livery, recolor }: VehicleBodySpec): Group {
    const model = this.models.get(silhouette);
    if (!model) return new Group();

    const clone = model.prototype.clone(true);
    if (recolor && model.paintMaterialName) {
      repaint(clone, model.paintMaterialName, livery.body);
    }
    return clone;
  }
}

/**
 * Normalises an authored model into engine space: uniform scale to the target
 * length, origin at the centre of the wheelbase with tyres on y=0, and rotated
 * so the nose points down the road (the pack authors forward as +Z).
 */
function prepareModel(root: Object3D, targetLength: number): PreparedModel {
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const centre = bounds.getCenter(new Vector3());

  const scale = targetLength / Math.max(0.001, size.z);
  root.scale.setScalar(scale);
  root.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);
  root.traverse((node) => {
    if ((node as Mesh).isMesh) node.frustumCulled = true;
  });

  const facing = new Group();
  facing.add(root);
  facing.rotation.y = Math.PI;

  const prototype = new Group();
  prototype.add(facing);

  return {
    prototype,
    length: targetLength,
    width: size.x * scale,
    paintMaterialName: findPaintMaterialName(root),
  };
}

/**
 * The pack embeds several materials per car (paint, glass, tyres, lights).
 * The body panels always own the most vertices, which is a far more robust
 * signal than matching on authored material names.
 */
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
      // Clone so the shared prototype material is never mutated. The flag lets
      // the workshop dispose exactly these copies and nothing else.
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
