import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Scene,
} from 'three';

import type { GameSystem, SystemContext, VehicleObject } from '@/engine/types';

const STREAK_COUNT = 54;
const STREAK_MIN_Z = -155;
const STREAK_MAX_Z = 18;

/** Cheap one-draw-call speed streaks plus hero-car effects for the Nitro power fantasy. */
export class SpeedFxSystem implements GameSystem {
  readonly name = 'speedFx';

  private readonly flames = new Group();
  private readonly streaks: LineSegments;
  private readonly shockwave: Mesh;
  private readonly shockwaveMaterial: MeshBasicMaterial;

  constructor(scene: Scene, player: VehicleObject) {
    const flameGeometry = new BoxGeometry(0.19, 0.19, 2.15);
    const cyan = new MeshBasicMaterial({ color: 0x43dfff, transparent: true, opacity: 0.96 });
    const white = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const hot = new MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.88 });

    const left = new Mesh(flameGeometry, cyan);
    const right = new Mesh(flameGeometry, white);
    const centre = new Mesh(new BoxGeometry(0.1, 0.1, 1.7), hot);
    left.position.set(-0.52, 0.42, 2.4);
    right.position.set(0.52, 0.42, 2.4);
    centre.position.set(0, 0.34, 2.15);
    this.flames.add(left, right, centre);
    this.flames.visible = false;
    player.add(this.flames);

    this.shockwaveMaterial = new MeshBasicMaterial({
      color: 0x8df5ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.shockwave = new Mesh(new RingGeometry(0.75, 1.05, 24), this.shockwaveMaterial);
    this.shockwave.position.set(0, 1.0, 1.2);
    this.shockwave.visible = false;
    player.add(this.shockwave);

    const positions = new Float32Array(STREAK_COUNT * 6);
    for (let i = 0; i < STREAK_COUNT; i++) this.seedStreak(positions, i);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color: 0xd9faff, transparent: true, opacity: 0.58 });
    this.streaks = new LineSegments(geometry, material);
    this.streaks.visible = false;
    scene.add(this.streaks);
  }

  update({ state, tuning, dt, scroll }: SystemContext): void {
    const nitro = state.nitroRemaining > 0;
    const grace = state.nitroGraceRemaining > 0;
    const streakMode = nitro || grace || state.intensity > 0.74;
    this.flames.visible = nitro;
    this.streaks.visible = streakMode;

    if (nitro) {
      const pulse = 0.88 + Math.random() * 0.9;
      this.flames.scale.set(1 + Math.random() * 0.08, 1 + Math.random() * 0.08, pulse);
      this.flames.rotation.z = (Math.random() - 0.5) * 0.08;
    }

    const ignitionAge = tuning.nitroSeconds - state.nitroRemaining;
    const ignition = nitro && ignitionAge >= 0 && ignitionAge < 0.24;
    this.shockwave.visible = ignition || grace;
    if (ignition) {
      const t = Math.min(1, ignitionAge / 0.24);
      this.shockwave.scale.setScalar(0.8 + t * 4.6);
      this.shockwaveMaterial.color.setHex(0x8df5ff);
      this.shockwaveMaterial.opacity = (1 - t) * 0.82;
    } else if (grace) {
      const t = Math.min(1, state.nitroGraceRemaining);
      this.shockwave.scale.setScalar(2.6 + (1 - t) * 0.6);
      this.shockwaveMaterial.color.setHex(0x8dffcf);
      this.shockwaveMaterial.opacity = 0.18 + t * 0.12;
    } else {
      this.shockwaveMaterial.opacity = 0;
    }

    if (!streakMode) return;
    const attribute = this.streaks.geometry.getAttribute('position') as Float32BufferAttribute;
    const boost = nitro ? 2.75 : grace ? 1.7 : 1.35;

    for (let i = 0; i < STREAK_COUNT; i++) {
      const a = i * 2;
      const b = a + 1;
      const dz = scroll * boost + dt * (nitro ? 34 : grace ? 16 : 8);
      let za = attribute.getZ(a) + dz;
      let zb = attribute.getZ(b) + dz;
      if (za > STREAK_MAX_Z) {
        const x = (Math.random() - 0.5) * 23;
        const y = 0.35 + Math.random() * 7.2;
        za = STREAK_MIN_Z - Math.random() * 30;
        zb = za + 2.5 + Math.random() * (nitro ? 10 : grace ? 6 : 3.5);
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
    this.shockwave.visible = false;
    this.shockwaveMaterial.opacity = 0;
  }

  private seedStreak(positions: Float32Array, index: number): void {
    const i = index * 6;
    const x = (Math.random() - 0.5) * 23;
    const y = 0.35 + Math.random() * 7.2;
    const z = STREAK_MIN_Z + Math.random() * (STREAK_MAX_Z - STREAK_MIN_Z);
    const length = 2 + Math.random() * 5;
    positions[i] = x;
    positions[i + 1] = y;
    positions[i + 2] = z;
    positions[i + 3] = x;
    positions[i + 4] = y;
    positions[i + 5] = z + length;
  }
}
