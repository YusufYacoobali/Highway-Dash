import {
  CircleGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';

import { pickRandom } from '@/core/math';
import type { VehicleSilhouette } from '@/domain/cars';
import type { Livery, VehicleBodyProvider, VehicleBodySpec, VehicleObject } from '@/engine/types';
import { GltfBodyProvider } from './GltfBodyProvider';
import { ProceduralBodyProvider } from './ProceduralBodyProvider';

/** Traffic paint used by the procedural bodies, matched to the mockup. */
const TRAFFIC_COLORS = [
  '#3B7BE0',
  '#F2B705',
  '#2FBF71',
  '#9B5DE5',
  '#F25C54',
  '#24C6DC',
  '#F08A24',
  '#EDEDED',
];

export function randomTrafficLivery(): Livery {
  const body = pickRandom(TRAFFIC_COLORS);
  return { body, roof: darken(body, 0.82) };
}

/**
 * Weighted traffic mix. Trucks used to be 20% of every spawn which made the
 * road feel like a delivery-van simulator and amplified their wide footprint.
 */
export function randomTrafficSilhouette(): VehicleSilhouette {
  const roll = Math.random();
  if (roll < 0.08) return 'truck';
  if (roll < 0.28) return 'suv';
  if (roll < 0.46) return 'hatch';
  return 'sedan';
}

export function darken(hex: string, factor: number): string {
  return `#${new Color(hex).multiplyScalar(factor).getHexString()}`;
}

const BLOB_SHADOW_NAME = 'blob-shadow';

/**
 * One flat, unlit ellipse per vehicle, standing in for real shadow mapping.
 * Every vehicle shares this geometry and material, and the whole effect costs
 * a single extra draw call per car rather than an entire depth pass over every
 * object in the scene — which is what makes the game viable on the expo-gl bridge.
 */
const blobShadowGeometry = new CircleGeometry(1, 10);
const blobShadowMaterial = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});

function createBlobShadow(length: number, width: number): Mesh {
  const shadow = new Mesh(blobShadowGeometry, blobShadowMaterial);
  shadow.name = BLOB_SHADOW_NAME;
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(width * 0.52, length * 0.46, 1);
  shadow.position.y = 0.04;
  shadow.renderOrder = -1;
  return shadow;
}

/** Owns vehicle construction and the switch from procedural to glTF bodies. */
export class VehicleWorkshop {
  private provider: VehicleBodyProvider = new ProceduralBodyProvider();
  private preparedProvider: GltfBodyProvider | null = null;
  private readonly issued = new Set<VehicleObject>();

  get providerId(): string {
    return this.provider.id;
  }

  create(spec: VehicleBodySpec): VehicleObject {
    const vehicle = new Group() as VehicleObject;
    const { length, width } = this.provider.dimensions(spec.silhouette);

    vehicle.userData = {
      length,
      width,
      silhouette: spec.silhouette,
      livery: spec.livery,
      speed: 0,
      passed: false,
    };
    vehicle.add(createBlobShadow(length, width), this.buildBody(spec));

    this.issued.add(vehicle);
    return vehicle;
  }

  /** Re-paints/rebuilds an existing vehicle in place. */
  reskin(vehicle: VehicleObject, silhouette: VehicleSilhouette, livery: Livery, recolor: boolean): void {
    const { length, width } = this.provider.dimensions(silhouette);
    vehicle.userData.silhouette = silhouette;
    vehicle.userData.livery = livery;
    vehicle.userData.length = length;
    vehicle.userData.width = width;

    this.replaceBody(vehicle, { silhouette, livery, recolor });
  }

  /**
   * Decode the glTF pack without touching live scene objects. Applying models
   * during an active run caused a first-run render/state race on native builds.
   */
  async prepareModels(): Promise<boolean> {
    if (this.provider.id === 'gltf' || this.preparedProvider) return true;
    const gltf = await GltfBodyProvider.load();
    if (!gltf) return false;
    this.preparedProvider = gltf;
    return true;
  }

  /** Apply an already-decoded pack synchronously between gameplay frames. */
  activatePreparedModels(playerVehicle: VehicleObject | null): boolean {
    if (this.provider.id === 'gltf') return true;
    if (!this.preparedProvider) return false;

    this.provider = this.preparedProvider;
    this.preparedProvider = null;

    for (const vehicle of this.issued) {
      const { silhouette, livery } = vehicle.userData;
      this.reskin(vehicle, silhouette, livery, vehicle === playerVehicle);
    }
    return true;
  }

  /** Backwards-compatible helper for callers that explicitly want an immediate switch. */
  async upgradeToModels(playerVehicle: VehicleObject | null): Promise<boolean> {
    if (!(await this.prepareModels())) return false;
    return this.activatePreparedModels(playerVehicle);
  }

  forget(vehicle: VehicleObject): void {
    this.issued.delete(vehicle);
  }

  /** Swaps the body while leaving the vehicle's shared blob shadow in place. */
  private replaceBody(vehicle: VehicleObject, spec: VehicleBodySpec): void {
    for (let i = vehicle.children.length - 1; i >= 0; i--) {
      const child = vehicle.children[i];
      if (child.name === BLOB_SHADOW_NAME) {
        child.scale.set(vehicle.userData.width * 0.52, vehicle.userData.length * 0.46, 1);
        continue;
      }
      vehicle.remove(child);
      releaseGpuResources(child);
    }
    vehicle.add(this.buildBody(spec));
  }

  /** Stamps ownership on the body so it can be disposed correctly later. */
  private buildBody(spec: VehicleBodySpec): Group {
    const body = this.provider.build(spec);
    body.userData.ownsGpuResources = this.provider.ownsGpuResources;
    return body;
  }
}

/** Frees a discarded body's GPU buffers without disposing shared glTF data. */
function releaseGpuResources(root: Object3D): void {
  const owned = root.userData.ownsGpuResources === true;

  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;

    if (owned) mesh.geometry?.dispose();

    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (owned || material?.userData.disposable === true) material?.dispose();
    }
  });
}
