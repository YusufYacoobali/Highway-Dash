import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { VehicleSilhouette } from '@/domain/cars';
import { VEHICLE_LENGTH } from '@/engine/config';
import type { VehicleBodyProvider, VehicleBodySpec } from '@/engine/types';

const TRIM = {
  dark: 0x1b2330,
  glass: 0x2c3e55,
  headlight: 0xffe9a8,
  taillight: 0xe8443a,
  chrome: 0xbfc7d2,
  cargo: 0xf0efea,
  stripe: 0xffffff,
} as const;

const WIDTH: Record<VehicleSilhouette, number> = {
  sports: 2.5,
  sedan: 2.5,
  hatch: 2.4,
  suv: 2.6,
  truck: 3,
};

/** A positioned piece of bodywork, keyed by which material paints it. */
interface BodyPart {
  slot: PaintSlot;
  geometry: BufferGeometry;
}

type PaintSlot = 'paint' | 'roof' | 'glass' | 'dark' | 'trim' | 'cargo' | 'stripe';

/**
 * Low-poly box car assembled from primitives. This is the guaranteed-available
 * body: the game is fully playable on it if the glTF pack fails to load, and
 * it renders on the very first frame while the models are still decoding.
 *
 * Parts are merged per material before being handed back, turning a twenty-mesh
 * car into six or seven draw calls. With dozens of cars on screen that is the
 * difference between a smooth frame and a stalled one.
 */
export class ProceduralBodyProvider implements VehicleBodyProvider {
  readonly id = 'procedural';
  readonly ownsGpuResources = true;

  dimensions(silhouette: VehicleSilhouette): { length: number; width: number } {
    return { length: VEHICLE_LENGTH[silhouette], width: WIDTH[silhouette] };
  }

  build({ silhouette, livery }: VehicleBodySpec): Group {
    const { length, width } = this.dimensions(silhouette);
    const parts: BodyPart[] = [];

    const isTruck = silhouette === 'truck';
    const isTall = silhouette === 'suv';

    const chassis = new BoxGeometry(width, isTruck ? 1.5 : 1.05, length);
    chassis.translate(0, 0.92, 0);
    parts.push({ slot: 'paint', geometry: chassis });

    if (isTruck) {
      this.addCargoBox(parts, width, length);
    } else {
      this.addCabin(parts, width, length, isTall);
    }

    if (silhouette === 'sports') this.addRacingKit(parts, width, length);

    this.addWheels(parts, width, length);
    this.addLights(parts, width, length);

    return assemble(parts, livery);
  }

  private addCargoBox(parts: BodyPart[], width: number, length: number): void {
    const box = new BoxGeometry(width + 0.12, 2.5, length * 0.62);
    box.translate(0, 2.65, -length * 0.12);

    const cab = new BoxGeometry(width - 0.2, 1.5, 1.9);
    cab.translate(0, 2.15, length * 0.34);

    const windscreen = new BoxGeometry(width - 0.5, 0.85, 0.14);
    windscreen.translate(0, 2.3, length * 0.34 + 0.95);

    parts.push(
      { slot: 'cargo', geometry: box },
      { slot: 'paint', geometry: cab },
      { slot: 'glass', geometry: windscreen },
    );
  }

  private addCabin(parts: BodyPart[], width: number, length: number, isTall: boolean): void {
    const cabinLength = isTall ? length * 0.62 : length * 0.5;
    const rise = isTall ? 0.2 : 0;
    const centre = isTall ? -0.1 : -0.35;

    const cabin = new BoxGeometry(width - 0.28, isTall ? 1.35 : 0.95, cabinLength);
    cabin.translate(0, 1.42 + rise, centre);

    const roofGlass = new BoxGeometry(width - 0.5, 0.06, cabinLength - 0.7);
    roofGlass.translate(0, 1.92 + rise * 1.5, centre);

    const rearGlass = new BoxGeometry(width - 0.5, 0.72, 0.12);
    rearGlass.translate(0, 1.5 + rise, centre + cabinLength / 2);

    const frontGlass = new BoxGeometry(width - 0.5, 0.66, 0.12);
    frontGlass.translate(0, 1.5 + rise, centre - cabinLength / 2);

    parts.push(
      { slot: 'roof', geometry: cabin },
      { slot: 'glass', geometry: roofGlass },
      { slot: 'glass', geometry: rearGlass },
      { slot: 'glass', geometry: frontGlass },
    );
  }

  private addRacingKit(parts: BodyPart[], width: number, length: number): void {
    for (const x of [-0.38, 0.38]) {
      const roofStripe = new BoxGeometry(0.34, 0.06, length * 0.48);
      roofStripe.translate(x, 1.93, -0.35);

      const hoodStripe = new BoxGeometry(0.34, 0.06, length * 0.2);
      hoodStripe.translate(x, 1.46, -length * 0.36);

      const bootStripe = new BoxGeometry(0.34, 0.06, length * 0.18);
      bootStripe.translate(x, 1.46, length * 0.34);

      parts.push(
        { slot: 'stripe', geometry: roofStripe },
        { slot: 'stripe', geometry: hoodStripe },
        { slot: 'stripe', geometry: bootStripe },
      );
    }

    const spoiler = new BoxGeometry(width - 0.3, 0.14, 0.5);
    spoiler.translate(0, 1.62, length / 2 - 0.35);
    parts.push({ slot: 'dark', geometry: spoiler });
  }

  private addWheels(parts: BodyPart[], width: number, length: number): void {
    const axleZ = length / 2 - 1.15;

    for (const [x, z] of [
      [-width / 2, axleZ],
      [width / 2, axleZ],
      [-width / 2, -axleZ],
      [width / 2, -axleZ],
    ] as const) {
      const wheel = new CylinderGeometry(0.58, 0.58, 0.42, 8);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(x, 0.58, z);
      parts.push({ slot: 'dark', geometry: wheel });
    }
  }

  private addLights(parts: BodyPart[], width: number, length: number): void {
    for (const x of [-width / 2 + 0.5, width / 2 - 0.5]) {
      const rear = new BoxGeometry(0.6, 0.26, 0.12);
      rear.translate(x, 1.02, length / 2 + 0.01);

      const front = new BoxGeometry(0.62, 0.28, 0.12);
      front.translate(x, 1.02, -length / 2 - 0.01);

      parts.push({ slot: 'trim', geometry: rear }, { slot: 'trim', geometry: front });
    }

    const bumper = new BoxGeometry(width + 0.08, 0.3, 0.3);
    bumper.translate(0, 0.68, length / 2 + 0.05);
    parts.push({ slot: 'trim', geometry: bumper });
  }
}

/**
 * Lights, bumper and other small details all share one `trim` slot: at the
 * distance these cars are seen, a single accent colour is indistinguishable
 * from three, and it saves two draw calls per vehicle.
 */
function materialFor(slot: PaintSlot, livery: VehicleBodySpec['livery']): MeshLambertMaterial {
  switch (slot) {
    case 'paint':
      return new MeshLambertMaterial({ color: livery.body });
    case 'roof':
      return new MeshLambertMaterial({ color: livery.roof });
    case 'glass':
      return new MeshLambertMaterial({ color: TRIM.glass });
    case 'dark':
      return new MeshLambertMaterial({ color: TRIM.dark });
    case 'trim':
      return new MeshLambertMaterial({ color: TRIM.chrome });
    case 'cargo':
      return new MeshLambertMaterial({ color: TRIM.cargo });
    case 'stripe':
      return new MeshLambertMaterial({ color: TRIM.stripe });
  }
}

function assemble(parts: BodyPart[], livery: VehicleBodySpec['livery']): Group {
  const bySlot = new Map<PaintSlot, BufferGeometry[]>();
  for (const part of parts) {
    const bucket = bySlot.get(part.slot);
    if (bucket) bucket.push(part.geometry);
    else bySlot.set(part.slot, [part.geometry]);
  }

  const group = new Group();
  for (const [slot, geometries] of bySlot) {
    const merged = mergeGeometries(geometries);
    // The sources are copied into the merged buffer and are dead afterwards.
    for (const geometry of geometries) geometry.dispose();
    if (merged) group.add(new Mesh(merged, materialFor(slot, livery)));
  }
  return group;
}
