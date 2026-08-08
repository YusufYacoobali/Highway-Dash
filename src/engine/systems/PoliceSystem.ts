import { BoxGeometry, Mesh, MeshBasicMaterial, Scene } from 'three';

import { clamp01, damp, lerp } from '@/core/math';
import { HEAT, laneOffsetsFor } from '@/engine/config';
import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';
import { VehicleWorkshop } from '@/engine/vehicles/VehicleWorkshop';
import { PLAYER_MODEL_ID } from '@/engine/vehicles/vehicleModelConfig';

const MAX_POLICE = 2;

interface PoliceRig {
  vehicle: VehicleObject;
  red: Mesh;
  blue: Mesh;
}

export interface PoliceObserver {
  /** The lead interceptor made contact — the run is over. */
  onBust(): void;
}

/** Police chase flavour changes per event and follows whichever road layout is active. */
export class PoliceSystem implements GameSystem {
  readonly name = 'police';

  private readonly rigs: PoliceRig[] = [];
  private flashClock = 0;

  constructor(
    scene: Scene,
    private readonly workshop: VehicleWorkshop,
    private readonly observer: PoliceObserver,
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

  update({ state, player, dt }: SystemContext): void {
    this.flashClock += dt;
    const chaseActive =
      state.mode === 'run' && !state.crashed && (state.stars >= 2 || state.event === 'police');
    const variant = state.event === 'police' ? state.eventVariant % 4 : 0;
    const forcePair = state.event === 'police' && (variant === 1 || variant === 2);
    const desired = !chaseActive ? 0 : state.stars >= 4 || forcePair ? 2 : 1;
    const flashRate = variant === 3 ? 13 : 9;
    const flash = Math.floor(this.flashClock * flashRate) % 2 === 0;
    const lanes = laneOffsetsFor(state.laneCount);
    let nearest = Infinity;

    this.rigs.forEach((rig, index) => {
      const active = index < desired;
      rig.vehicle.visible = active;
      if (!active) return;

      // Measured from where the cruiser actually is, so the siren wash only
      // lights up when one is genuinely filling the mirror.
      const gapZ = rig.vehicle.position.z - player.position.z;
      const gapX = Math.abs(rig.vehicle.position.x - player.position.x);
      if (gapZ > 0 && gapX < HEAT.sirenLateral) nearest = Math.min(nearest, gapZ);

      rig.red.visible = flash !== (index % 2 === 0);
      rig.blue.visible = !rig.red.visible;

      const innerLane = Math.max(0, Math.min(lanes.length - 1, index === 0 ? 1 : lanes.length - 2));
      const outerLane = index === 0 ? 0 : lanes.length - 1;
      const lane = variant === 2 ? outerLane : innerLane;
      const weaveScale = variant === 1 ? 1.18 : variant === 3 ? 0.92 : 0.72;
      const weaveRate = variant === 1 ? 2.05 : variant === 3 ? 1.35 : 1.6;
      const weave =
        Math.sin(state.elapsed * (weaveRate + index * 0.18) + index * 2.2) * weaveScale;
      const targetX = (lanes[lane] ?? 0) + weave;
      const eventPressure = variant === 1 ? 0.66 : variant === 2 ? 0.56 : variant === 3 ? 0.5 : 0.45;
      const pressure = Math.max(state.policePressure, state.event === 'police' ? eventPressure : 0);
      const closeOffset = variant === 1 ? 3 : variant === 3 ? 1.5 : 0;
      // Boosting physically buys road. Without this the escape is only a
      // number on the HUD — the player has to *see* them drop back.
      const escapeGap = state.nitroRemaining > 0 ? HEAT.nitroPushback : 0;
      const patrolZ = 15 - pressure * 8 - closeOffset + index * 4.5 + escapeGap;

      // Only the lead car commits to the PIT. Two cars converging on the
      // player at once reads as noise; one closing car reads as a threat.
      const isLead = index === 0;
      const threat = isLead ? state.bustThreat : state.bustThreat * 0.45;
      const targetZ = lerp(patrolZ, player.position.z, threat);
      // It also stops weaving and locks onto the player's line as it closes.
      const lockedX = lerp(targetX, player.position.x, threat * (isLead ? 0.92 : 0.4));

      const chaseRate = variant === 1 ? 4.8 : 3.8;
      rig.vehicle.position.x = damp(rig.vehicle.position.x, lockedX, chaseRate + threat * 3, dt);
      rig.vehicle.position.z = damp(
        rig.vehicle.position.z,
        targetZ,
        (variant === 1 ? 3.5 : 2.7) + threat * 2.4,
        dt,
      );
      rig.vehicle.position.y = 0;
      rig.vehicle.rotation.y = -weave * 0.05 * (1 - threat);

      if (isLead && threat > 0 && this.isPitContact(rig.vehicle, player)) {
        this.observer.onBust();
        return;
      }

      if (pressure > 0.62 || threat > 0) {
        const pulse = variant === 3 ? 0.06 * (0.5 + Math.sin(this.flashClock * 10) * 0.5) : 0;
        state.cameraShake = Math.max(
          state.cameraShake,
          0.16 + pressure * 0.1 + pulse + threat * 0.45,
        );
      }
    });

    state.policeProximity =
      nearest === Infinity
        ? 0
        : clamp01((HEAT.sirenFar - nearest) / (HEAT.sirenFar - HEAT.sirenNear));
  }

  private isPitContact(cruiser: VehicleObject, player: VehicleObject): boolean {
    return (
      Math.abs(cruiser.position.z - player.position.z) < HEAT.bustContactZ &&
      Math.abs(cruiser.position.x - player.position.x) < HEAT.bustContactX
    );
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
