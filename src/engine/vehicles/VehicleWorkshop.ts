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
import { VEHICLE_SCALE } from '@/engine/config';
import type { Livery, VehicleBodyProvider, VehicleBodySpec, VehicleObject } from '@/engine/types';
import { GltfBodyProvider } from './GltfBodyProvider';
import { ProceduralBodyProvider } from './ProceduralBodyProvider';

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
    const raw = this.provider.dimensions(spec.silhouette);
    const length = raw.length * VEHICLE_SCALE;
    const width = raw.width * VEHICLE_SCALE;

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
    const raw = this.provider.dimensions(silhouette);
    vehicle.userData.silhouette = silhouette;
    vehicle.userData.livery = livery;
    vehicle.userData.length = raw.length * VEHICLE_SCALE;
    vehicle.userData.width = raw.width * VEHICLE_SCALE;

    this.replaceBody(vehicle, { silhouette, livery, recolor });
  }

  async prepareModels(): Promise<boolean> {
    if (this.provider.id === 'gltf' || this.preparedProvider) return true;
    const gltf = await GltfBodyProvider.load();
    if (!gltf) return false;
    this.preparedProvider = gltf;
    return true;
  }

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

  async upgradeToModels(playerVehicle: VehicleObject | null): Promise<boolean> {
    if (!(await this.prepareModels())) return false;
    return this.activatePreparedModels(playerVehicle);
  }

  forget(vehicle: VehicleObject): void {
    this.issued.delete(vehicle);
  }

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

  /** Every authored and procedural body is globally scaled to 80%. */
  private buildBody(spec: VehicleBodySpec): Group {
    const body = this.provider.build(spec);
    body.scale.multiplyScalar(VEHICLE_SCALE);
    body.userData.ownsGpuResources = this.provider.ownsGpuResources;
    return body;
  }
}

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
