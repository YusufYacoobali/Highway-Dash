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

/** Police chase flavour changes per event without adding expensive new models. */
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
    const variant = state.event === 'police' ? state.eventVariant % 4 : 0;
    const forcePair = state.event === 'police' && (variant === 1 || variant === 2);
    const desired = !chaseActive ? 0 : state.stars >= 4 || forcePair ? 2 : 1;
    const flashRate = variant === 3 ? 13 : 9;
    const flash = Math.floor(this.flashClock * flashRate) % 2 === 0;

    this.rigs.forEach((rig, index) => {
      const active = index < desired;
      rig.vehicle.visible = active;
      if (!active) return;

      rig.red.visible = flash !== (index % 2 === 0);
      rig.blue.visible = !rig.red.visible;

      const baseLane = index === 0 ? 1 : 2;
      const lane = variant === 2 ? (index === 0 ? 0 : 3) : baseLane;
      const weaveScale = variant === 1 ? 1.18 : variant === 3 ? 0.92 : 0.72;
      const weaveRate = variant === 1 ? 2.05 : variant === 3 ? 1.35 : 1.6;
      const weave = Math.sin(state.elapsed * (weaveRate + index * 0.18) + index * 2.2) * weaveScale;
      const targetX = LANE_OFFSETS[lane] + weave;
      const eventPressure = variant === 1 ? 0.66 : variant === 2 ? 0.56 : variant === 3 ? 0.5 : 0.45;
      const pressure = Math.max(state.policePressure, state.event === 'police' ? eventPressure : 0);
      const closeOffset = variant === 1 ? 3 : variant === 3 ? 1.5 : 0;
      const targetZ = 15 - pressure * 8 - closeOffset + index * 4.5;

      rig.vehicle.position.x = damp(rig.vehicle.position.x, targetX, variant === 1 ? 4.8 : 3.8, dt);
      rig.vehicle.position.z = damp(rig.vehicle.position.z, targetZ, variant === 1 ? 3.5 : 2.7, dt);
      rig.vehicle.position.y = 0;
      rig.vehicle.rotation.y = -weave * 0.05;

      if (pressure > 0.62) {
        const pulse = variant === 3 ? 0.06 * (0.5 + Math.sin(this.flashClock * 10) * 0.5) : 0;
        state.cameraShake = Math.max(state.cameraShake, 0.16 + pressure * 0.1 + pulse);
      }
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
