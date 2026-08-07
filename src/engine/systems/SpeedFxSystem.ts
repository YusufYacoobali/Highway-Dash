import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Scene,
} from 'three';

import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';

const STREAK_COUNT = 34;
const STREAK_MIN_Z = -145;
const STREAK_MAX_Z = 18;

/** One-draw-call speed streaks plus two tiny exhaust meshes sell extreme velocity. */
export class SpeedFxSystem implements GameSystem {
  readonly name = 'speedFx';

  private readonly flames = new Group();
  private readonly streaks: LineSegments;

  constructor(scene: Scene, player: VehicleObject) {
    const flameGeometry = new BoxGeometry(0.16, 0.16, 1.35);
    const cyan = new MeshBasicMaterial({ color: 0x65eaff, transparent: true, opacity: 0.92 });
    const white = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });

    const left = new Mesh(flameGeometry, cyan);
    const right = new Mesh(flameGeometry, white);
    left.position.set(-0.52, 0.42, 2.0);
    right.position.set(0.52, 0.42, 2.0);
    this.flames.add(left, right);
    this.flames.visible = false;
    player.add(this.flames);

    const positions = new Float32Array(STREAK_COUNT * 6);
    for (let i = 0; i < STREAK_COUNT; i++) this.seedStreak(positions, i);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color: 0xc9f5ff, transparent: true, opacity: 0.48 });
    this.streaks = new LineSegments(geometry, material);
    this.streaks.visible = false;
    scene.add(this.streaks);
  }

  update({ state, dt, scroll }: SystemContext): void {
    const nitro = state.nitroRemaining > 0;
    const streakMode = nitro || state.intensity > 0.72;
    this.flames.visible = nitro;
    this.streaks.visible = streakMode;

    if (nitro) {
      const pulse = 0.72 + Math.random() * 0.72;
      this.flames.scale.set(1, 1, pulse);
      this.flames.rotation.z = (Math.random() - 0.5) * 0.06;
    }

    if (!streakMode) return;
    const attribute = this.streaks.geometry.getAttribute('position') as Float32BufferAttribute;
    const boost = nitro ? 2.25 : 1.35;

    for (let i = 0; i < STREAK_COUNT; i++) {
      const a = i * 2;
      const b = a + 1;
      const dz = scroll * boost + dt * (nitro ? 22 : 8);
      let za = attribute.getZ(a) + dz;
      let zb = attribute.getZ(b) + dz;
      if (za > STREAK_MAX_Z) {
        const x = (Math.random() - 0.5) * 22;
        const y = 0.4 + Math.random() * 6.5;
        za = STREAK_MIN_Z - Math.random() * 25;
        zb = za + 2.2 + Math.random() * (nitro ? 7 : 3.5);
        attribute.setXYZ(a, x, y, za);
        attribute.setXYZ(b, x, y, zb);
      } else {
        attribute.setZ(a, za);
        attribute.setZ(b, zb);
      }
    }
    attribute.needsUpdate = true;
  }

  reset(): void {
    this.flames.visible = false;
    this.streaks.visible = false;
  }

  private seedStreak(positions: Float32Array, index: number): void {
    const i = index * 6;
    const x = (Math.random() - 0.5) * 22;
    const y = 0.4 + Math.random() * 6.5;
    const z = STREAK_MIN_Z + Math.random() * (STREAK_MAX_Z - STREAK_MIN_Z);
    const length = 2 + Math.random() * 4;
    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z;
    positions[i + 3] = x;
    positions[i + 4] = y;
    positions[i + 5] = z + length;
  }
}
