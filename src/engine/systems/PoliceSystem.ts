import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
} from 'three';

import { clamp, damp } from '@/core/math';
import { POLICE, SCORING } from '@/engine/config';
import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';
import { VehicleWorkshop } from '@/engine/vehicles/VehicleWorkshop';

const LIGHTBAR_NAME = 'police-lightbar';
const POLICE_BODY = '#2367d1';
const POLICE_ROOF = '#f5f7fb';

interface PoliceUnit {
  vehicle: VehicleObject;
  side: -1 | 1;
  phase: number;
}

/**
 * A lightweight visual pursuit that joins the run at ~3 km. The units live
 * behind the player in chase-camera space, close in as distance rises and fall
 * back temporarily when nitro is fired.
 */
export class PoliceSystem implements GameSystem {
  readonly name = 'police';

  private readonly units: PoliceUnit[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly workshop: VehicleWorkshop,
  ) {}

  update({ state, player, dt }: SystemContext): void {
    const distanceMeters = state.distance * SCORING.distanceScale;
    const active =
      state.mode === 'run' &&
      !state.crashed &&
      distanceMeters >= POLICE.startDistanceMeters;

    if (!active) {
      for (const unit of this.units) unit.vehicle.visible = false;
      return;
    }

    this.ensureUnits();
    const aggression = clamp(
      (distanceMeters - POLICE.startDistanceMeters) / POLICE.aggressionRampMeters,
      0,
      1,
    );

    for (let i = 0; i < this.units.length; i++) {
      const unit = this.units[i];
      const vehicle = unit.vehicle;
      vehicle.visible = true;
      this.ensureLightbar(vehicle);

      const lateral = POLICE.lateralOffset - aggression * 0.75;
      const targetX = clamp(player.position.x + unit.side * lateral, -5.15, 5.15);
      const nitroFallback = state.nitroRemaining > 0 ? POLICE.nitroFallbackDistance : 0;
      const targetZ =
        player.position.z + POLICE.followDistance + i * 1.8 + nitroFallback;
      const rate = POLICE.followRate + aggression * 2.8;

      vehicle.position.x = damp(vehicle.position.x, targetX, rate, dt);
      vehicle.position.z = damp(vehicle.position.z, targetZ, rate * 0.9, dt);
      vehicle.position.y = 0;
      vehicle.rotation.y = clamp((targetX - vehicle.position.x) * -0.08, -0.22, 0.22);
      vehicle.rotation.z = clamp((targetX - vehicle.position.x) * 0.04, -0.12, 0.12);

      unit.phase += dt * (5.5 + aggression * 3);
      this.animateLightbar(vehicle, unit.phase);
    }
  }

  reset(): void {
    for (let i = 0; i < this.units.length; i++) {
      const unit = this.units[i];
      unit.vehicle.visible = false;
      unit.vehicle.position.set(unit.side * 4.2, 0, 10 + i * 2);
      unit.vehicle.rotation.set(0, 0, 0);
      unit.phase = i * Math.PI;
    }
  }

  dispose(): void {
    for (const unit of this.units) {
      const lightbar = unit.vehicle.getObjectByName(LIGHTBAR_NAME) as Group | undefined;
      lightbar?.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
      this.scene.remove(unit.vehicle);
      this.workshop.forget(unit.vehicle);
    }
    this.units.length = 0;
  }

  private ensureUnits(): void {
    if (this.units.length > 0) return;

    for (const side of [-1, 1] as const) {
      const vehicle = this.workshop.create({
        silhouette: 'sedan',
        livery: { body: POLICE_BODY, roof: POLICE_ROOF },
        recolor: true,
      });
      vehicle.visible = true;
      vehicle.position.set(side * 4.2, 0, 9);
      this.ensureLightbar(vehicle);
      this.scene.add(vehicle);
      this.units.push({ vehicle, side, phase: side < 0 ? 0 : Math.PI });
    }
  }

  private ensureLightbar(vehicle: VehicleObject): void {
    if (vehicle.getObjectByName(LIGHTBAR_NAME)) return;

    const bar = new Group();
    bar.name = LIGHTBAR_NAME;
    bar.position.set(0, 2.28, 0.15);

    const red = new Mesh(
      new BoxGeometry(0.72, 0.2, 0.28),
      new MeshBasicMaterial({ color: 0xff2438 }),
    );
    red.name = 'police-red';
    red.position.x = -0.38;

    const blue = new Mesh(
      new BoxGeometry(0.72, 0.2, 0.28),
      new MeshBasicMaterial({ color: 0x2494ff }),
    );
    blue.name = 'police-blue';
    blue.position.x = 0.38;

    bar.add(red, blue);
    vehicle.add(bar);
  }

  private animateLightbar(vehicle: VehicleObject, phase: number): void {
    const red = vehicle.getObjectByName('police-red');
    const blue = vehicle.getObjectByName('police-blue');
    if (!red || !blue) return;

    const redOn = Math.sin(phase) >= 0;
    red.visible = redOn;
    blue.visible = !redOn;
  }
}
