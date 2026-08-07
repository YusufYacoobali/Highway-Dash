import { BoxGeometry, Mesh, MeshBasicMaterial, Scene } from 'three';

import { damp } from '@/core/math';
import { LANE_OFFSETS } from '@/engine/config';
import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';
import { VehicleWorkshop } from '@/engine/vehicles/VehicleWorkshop';
import { PLAYER_MODEL_ID } from '@/engine/vehicles/vehicleModelConfig';

const MAX_POLICE = 2;

interface PoliceRig {
  vehicle: VehicleObject;
  red: Mesh;
  blue: Mesh;
}

/**
 * Police are readable on-screen threats, not a hidden wanted timer. They live
 * behind the player, close in as heat rises and flash against the night/tunnel.
 */
export class PoliceSystem implements GameSystem {
  readonly name = 'police';

  private readonly rigs: PoliceRig[] = [];
  private flashClock = 0;

  constructor(
    scene: Scene,
    private readonly workshop: VehicleWorkshop,
  ) {
    const lightGeometry = new BoxGeometry(0.42, 0.16, 0.28);
    const redMaterial = new MeshBasicMaterial({ color: 0xff264f });
    const blueMaterial = new MeshBasicMaterial({ color: 0x24a8ff });

    for (let i = 0; i < MAX_POLICE; i++) {
      const vehicle = this.workshop.create({
        silhouette: 'sedan',
        livery: { body: '#1A2740', roof: '#F4F7FB' },
        modelId: PLAYER_MODEL_ID,
        recolor: true,
      });
      const red = new Mesh(lightGeometry, redMaterial);
      const blue = new Mesh(lightGeometry, blueMaterial);
      red.position.set(-0.3, 1.45, 0);
      blue.position.set(0.3, 1.45, 0);
      vehicle.add(red, blue);
      vehicle.visible = false;
      scene.add(vehicle);
      this.rigs.push({ vehicle, red, blue });
    }
  }

  update({ state, dt }: SystemContext): void {
    this.flashClock += dt;
    const chaseActive = state.mode === 'run' && !state.crashed && (state.stars >= 2 || state.event === 'police');
    const desired = !chaseActive ? 0 : state.stars >= 4 ? 2 : 1;
    const flash = Math.floor(this.flashClock * 9) % 2 === 0;

    this.rigs.forEach((rig, index) => {
      const active = index < desired;
      rig.vehicle.visible = active;
      if (!active) return;

      rig.red.visible = flash !== (index % 2 === 0);
      rig.blue.visible = !rig.red.visible;

      const lane = index === 0 ? 1 : 2;
      const weave = Math.sin(state.elapsed * (1.6 + index * 0.18) + index * 2.2) * 0.72;
      const targetX = LANE_OFFSETS[lane] + weave;
      const pressure = Math.max(state.policePressure, state.event === 'police' ? 0.45 : 0);
      const targetZ = 15 - pressure * 8 + index * 4.5;

      rig.vehicle.position.x = damp(rig.vehicle.position.x, targetX, 3.8, dt);
      rig.vehicle.position.z = damp(rig.vehicle.position.z, targetZ, 2.7, dt);
      rig.vehicle.position.y = 0;
      rig.vehicle.rotation.y = -weave * 0.05;

      if (pressure > 0.65) state.cameraShake = Math.max(state.cameraShake, 0.16 + pressure * 0.1);
    });
  }

  reset(): void {
    this.flashClock = 0;
    this.rigs.forEach((rig, index) => {
      rig.vehicle.visible = false;
      rig.vehicle.position.set(index ? 1.5 : -1.5, 0, 18 + index * 4);
      rig.vehicle.rotation.set(0, 0, 0);
    });
  }
}
