import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
} from 'three';

import { ROAD_LENGTH, ROAD_WIDTH } from '@/engine/config';
import type { GameSystem, SystemContext, WorldThemeId } from '@/engine/types';

const TUNNEL_SEGMENTS = 12;
const TUNNEL_SPACING = 16;
const STREETLIGHT_SEGMENTS = 12;
const STREETLIGHT_SPACING = 18;
const RAIN_COUNT = 190;
const SNOW_COUNT = 150;

/** Lightweight live-world dressing with several visually distinct chapters. */
export class WorldThemeSystem implements GameSystem {
  readonly name = 'worldTheme';

  private readonly tunnel = new Group();
  private readonly streetlights = new Group();
  private readonly coastWater = new Group();
  private readonly lavaFields = new Group();
  private readonly rain: Points;
  private readonly snow: Points;
  private currentTheme: WorldThemeId | null = null;

  constructor(private readonly scene: Scene) {
    this.buildTunnel();
    this.buildStreetlights();
    this.buildCoast();
    this.buildLava();
    this.rain = this.buildParticles(RAIN_COUNT, 0xbfdcff, 0.09, 'world-rain');
    this.snow = this.buildParticles(SNOW_COUNT, 0xffffff, 0.16, 'world-snow');
    this.scene.add(
      this.tunnel,
      this.streetlights,
      this.coastWater,
      this.lavaFields,
      this.rain,
      this.snow,
    );
    this.applyTheme('sunset');
  }

  update({ state, scroll, dt }: SystemContext): void {
    if (state.theme !== this.currentTheme) this.applyTheme(state.theme);

    if (this.tunnel.visible) this.scrollRepeater(this.tunnel, scroll, TUNNEL_SPACING);
    if (this.streetlights.visible) this.scrollRepeater(this.streetlights, scroll, STREETLIGHT_SPACING);
    if (this.rain.visible) this.updateRain(scroll, dt);
    if (this.snow.visible) this.updateSnow(scroll, dt);
  }

  reset({ state }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    this.resetRepeater(this.tunnel, TUNNEL_SPACING);
    this.resetRepeater(this.streetlights, STREETLIGHT_SPACING);
    this.applyTheme(state.theme);
  }

  private applyTheme(theme: WorldThemeId): void {
    this.currentTheme = theme;

    const sky = this.scene.getObjectByName('world-sky-dome') as Mesh | undefined;
    const sun = this.scene.getObjectByName('world-sun') as Mesh | undefined;
    const clouds = this.scene.getObjectByName('world-clouds') as Mesh | undefined;
    const ground = this.scene.getObjectByName('world-ground') as Mesh | undefined;
    const asphalt = this.scene.getObjectByName('world-asphalt') as Mesh | undefined;

    const skyMaterial = sky?.material as MeshBasicMaterial | undefined;
    const groundMaterial = ground?.material as MeshLambertMaterial | undefined;
    const asphaltMaterial = asphalt?.material as MeshLambertMaterial | undefined;

    const palette = themePalette(theme);
    skyMaterial?.color.set(palette.skyTint);
    groundMaterial?.color.set(palette.ground);
    asphaltMaterial?.color.set(palette.asphalt);

    if (this.scene.fog instanceof Fog) {
      this.scene.fog.color.set(palette.fog);
      this.scene.fog.near = palette.fogNear;
      this.scene.fog.far = palette.fogFar;
    }

    if (sun) {
      sun.visible = !['night', 'neon', 'tunnel', 'storm', 'volcano'].includes(theme);
      const sunMaterial = sun.material as MeshBasicMaterial;
      sunMaterial.color.set(
        theme === 'desert' ? '#fff0a3' : theme === 'snow' ? '#dff5ff' : '#fff2c2',
      );
    }
    if (clouds) clouds.visible = theme !== 'tunnel' && theme !== 'volcano';

    this.tunnel.visible = theme === 'tunnel';
    this.streetlights.visible = theme === 'night' || theme === 'storm' || theme === 'neon';
    this.coastWater.visible = theme === 'coast';
    this.lavaFields.visible = theme === 'volcano';
    this.rain.visible = theme === 'storm';
    this.snow.visible = theme === 'snow';
    this.recolorStreetlights(theme);
    this.recolorScenery(theme);

    this.scene.traverse((object) => {
      if (object instanceof HemisphereLight) {
        object.intensity = palette.hemi;
        object.color.set(palette.hemiColor);
        object.groundColor.set(palette.groundLight);
      } else if (object instanceof DirectionalLight) {
        object.intensity = palette.sunIntensity;
        object.color.set(palette.sunColor);
      }
    });
  }

  private recolorScenery(theme: WorldThemeId): void {
    const scenery = sceneryPalette(theme);
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshLambertMaterial)) return;

      if (object.name === 'world-tree-trunk') {
        object.material.color.set(scenery.trunk);
        return;
      }
      if (object.name !== 'world-tree-leaves') return;

      const index = Number(object.userData.paletteIndex ?? 0) % scenery.leaves.length;
      object.material.color.set(scenery.leaves[index] ?? scenery.leaves[0]);
      object.material.emissive.set(scenery.emissive);
      object.material.emissiveIntensity = scenery.emissiveIntensity;
    });
  }

  private buildTunnel(): void {
    this.tunnel.name = 'world-tunnel';
    const wall = new MeshLambertMaterial({ color: 0x17223a });
    const beam = new MeshLambertMaterial({ color: 0x253958 });
    const lightA = new MeshBasicMaterial({ color: 0x5bd9ff });
    const lightB = new MeshBasicMaterial({ color: 0xff4f9a });
    const columnGeometry = new BoxGeometry(0.8, 8.2, 0.8);
    const roofGeometry = new BoxGeometry(ROAD_WIDTH + 3.2, 0.7, 0.8);
    const lampGeometry = new BoxGeometry(2.4, 0.12, 0.9);

    for (let i = 0; i < TUNNEL_SEGMENTS; i++) {
      const frame = new Group();
      frame.position.z = 14 - i * TUNNEL_SPACING;

      const left = new Mesh(columnGeometry, wall);
      left.position.set(-ROAD_WIDTH / 2 - 0.9, 4.1, 0);
      const right = new Mesh(columnGeometry, wall);
      right.position.set(ROAD_WIDTH / 2 + 0.9, 4.1, 0);
      const top = new Mesh(roofGeometry, beam);
      top.position.set(0, 8.15, 0);
      const lamp = new Mesh(lampGeometry, i % 2 ? lightA : lightB);
      lamp.position.set(0, 7.72, -0.15);

      frame.add(left, right, top, lamp);
      this.tunnel.add(frame);
    }
  }

  private buildStreetlights(): void {
    this.streetlights.name = 'world-streetlights';
    const poleMaterial = new MeshLambertMaterial({ color: 0x26364d });
    const lampA = new MeshBasicMaterial({ color: 0x64dcff });
    const lampB = new MeshBasicMaterial({ color: 0xff5fa8 });
    const poleGeometry = new BoxGeometry(0.16, 6.5, 0.16);
    const lampGeometry = new BoxGeometry(0.7, 0.18, 0.7);

    for (let i = 0; i < STREETLIGHT_SEGMENTS; i++) {
      const pair = new Group();
      pair.position.z = 12 - i * STREETLIGHT_SPACING;
      for (const side of [-1, 1]) {
        const pole = new Mesh(poleGeometry, poleMaterial);
        pole.position.set(side * 8.2, 3.25, 0);
        const lamp = new Mesh(lampGeometry, i % 2 ? lampA : lampB);
        lamp.name = i % 2 ? 'street-lamp-a' : 'street-lamp-b';
        lamp.position.set(side * 8.2, 6.48, 0);
        pair.add(pole, lamp);
      }
      this.streetlights.add(pair);
    }
  }

  private recolorStreetlights(theme: WorldThemeId): void {
    const colors =
      theme === 'neon'
        ? ['#23f7ff', '#ff36bd']
        : theme === 'storm'
          ? ['#d4e8ff', '#91b8ff']
          : ['#64dcff', '#ff5fa8'];

    this.streetlights.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial)) return;
      object.material.color.set(object.name === 'street-lamp-a' ? colors[0] : colors[1]);
    });
  }

  private buildCoast(): void {
    this.coastWater.name = 'world-coast-water';
    const waterMaterial = new MeshLambertMaterial({ color: 0x2596d8 });
    const waterGeometry = new PlaneGeometry(150, ROAD_LENGTH);

    for (const side of [-1, 1]) {
      const water = new Mesh(waterGeometry, waterMaterial);
      water.rotation.x = -Math.PI / 2;
      water.position.set(side * 82, -0.04, -180);
      this.coastWater.add(water);
    }
  }

  private buildLava(): void {
    this.lavaFields.name = 'world-lava-fields';
    const lavaMaterial = new MeshBasicMaterial({ color: 0xff5b18 });
    const lavaGeometry = new PlaneGeometry(62, ROAD_LENGTH);

    for (const side of [-1, 1]) {
      const lava = new Mesh(lavaGeometry, lavaMaterial);
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(side * 38, -0.045, -180);
      this.lavaFields.add(lava);
    }
  }

  private buildParticles(count: number, color: number, size: number, name: string): Points {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      positions[j] = (Math.random() - 0.5) * 34;
      positions[j + 1] = 2 + Math.random() * 22;
      positions[j + 2] = -160 + Math.random() * 185;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color: new Color(color),
      size,
      transparent: true,
      opacity: 0.8,
    });
    const points = new Points(geometry, material);
    points.name = name;
    return points;
  }

  private updateRain(scroll: number, dt: number): void {
    const position = this.rain.geometry.getAttribute('position') as Float32BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      let y = position.getY(i) - dt * 30;
      let z = position.getZ(i) + scroll * 0.42;
      if (y < 0.4) y = 18 + Math.random() * 8;
      if (z > 20) z -= 185;
      position.setY(i, y);
      position.setZ(i, z);
    }
    position.needsUpdate = true;
  }

  private updateSnow(scroll: number, dt: number): void {
    const position = this.snow.geometry.getAttribute('position') as Float32BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      let x = position.getX(i) + Math.sin(i * 0.7 + dt * 3) * dt * 0.8;
      let y = position.getY(i) - dt * (4 + (i % 5));
      let z = position.getZ(i) + scroll * 0.3;
      if (y < 0.3) {
        y = 16 + Math.random() * 10;
        x = (Math.random() - 0.5) * 34;
      }
      if (z > 20) z -= 185;
      position.setXYZ(i, x, y, z);
    }
    position.needsUpdate = true;
  }

  private scrollRepeater(group: Group, scroll: number, spacing: number): void {
    const period = group.children.length * spacing;
    for (const child of group.children) {
      child.position.z += scroll;
      if (child.position.z > 18) child.position.z -= period;
    }
  }

  private resetRepeater(group: Group, spacing: number): void {
    group.children.forEach((child, index) => {
      child.position.z = 14 - index * spacing;
    });
  }
}

function sceneryPalette(theme: WorldThemeId): {
  trunk: string;
  leaves: readonly string[];
  emissive: string;
  emissiveIntensity: number;
} {
  switch (theme) {
    case 'desert':
      return {
        trunk: '#426b36',
        leaves: ['#4f823f', '#659344', '#7b9c4b'],
        emissive: '#000000',
        emissiveIntensity: 0,
      };
    case 'snow':
      return {
        trunk: '#48525a',
        leaves: ['#e8f6ff', '#bfdbe7', '#d5edf5'],
        emissive: '#000000',
        emissiveIntensity: 0,
      };
    case 'neon':
      return {
        trunk: '#182342',
        leaves: ['#23cde8', '#9d4dff', '#ff3fae'],
        emissive: '#29155a',
        emissiveIntensity: 0.32,
      };
    case 'volcano':
      return {
        trunk: '#1d1715',
        leaves: ['#5a2119', '#3b2420', '#7a2b1e'],
        emissive: '#45130a',
        emissiveIntensity: 0.24,
      };
    case 'storm':
      return {
        trunk: '#554535',
        leaves: ['#315f46', '#396c4e', '#284f3c'],
        emissive: '#000000',
        emissiveIntensity: 0,
      };
    case 'night':
      return {
        trunk: '#3a3440',
        leaves: ['#214f54', '#285d61', '#1b4348'],
        emissive: '#000000',
        emissiveIntensity: 0,
      };
    case 'tunnel':
      return {
        trunk: '#2f3642',
        leaves: ['#334457', '#3b4d62', '#2b3c50'],
        emissive: '#000000',
        emissiveIntensity: 0,
      };
    case 'coast':
      return {
        trunk: '#8a5930',
        leaves: ['#2d9f57', '#39b966', '#248c4d'],
        emissive: '#000000',
        emissiveIntensity: 0,
      };
    case 'forest':
    case 'sunset':
    default:
      return {
        trunk: '#8b5a2b',
        leaves: ['#3f9e33', '#4fbf3f', '#358c2e'],
        emissive: '#000000',
        emissiveIntensity: 0,
      };
  }
}

function themePalette(theme: WorldThemeId) {
  switch (theme) {
    case 'forest':
      return {
        skyTint: '#bfead2', ground: '#2f7b3e', asphalt: '#3d4347', fog: '#91c6ae',
        fogNear: 58, fogFar: 175, hemi: 0.92, hemiColor: '#dff6e4', groundLight: '#315d32',
        sunIntensity: 1.3, sunColor: '#fff0cf',
      };
    case 'tunnel':
      return {
        skyTint: '#18223b', ground: '#202a38', asphalt: '#252a32', fog: '#131c2d',
        fogNear: 38, fogFar: 120, hemi: 0.45, hemiColor: '#6eb9d2', groundLight: '#10141f',
        sunIntensity: 0.35, sunColor: '#90d9ff',
      };
    case 'night':
      return {
        skyTint: '#31406f', ground: '#163c43', asphalt: '#252a34', fog: '#1c2b4b',
        fogNear: 55, fogFar: 175, hemi: 0.62, hemiColor: '#8fc8ff', groundLight: '#141d32',
        sunIntensity: 0.62, sunColor: '#84a8ff',
      };
    case 'coast':
      return {
        skyTint: '#d4f3ff', ground: '#d9bd72', asphalt: '#45484c', fog: '#b9e6ef',
        fogNear: 68, fogFar: 205, hemi: 1.0, hemiColor: '#eaf9ff', groundLight: '#8b7b48',
        sunIntensity: 1.55, sunColor: '#fff1cf',
      };
    case 'storm':
      return {
        skyTint: '#647086', ground: '#315054', asphalt: '#2b3137', fog: '#536275',
        fogNear: 42, fogFar: 135, hemi: 0.58, hemiColor: '#a8bdd1', groundLight: '#26373d',
        sunIntensity: 0.42, sunColor: '#bcc7d2',
      };
    case 'desert':
      return {
        skyTint: '#ffd6a0', ground: '#c78c43', asphalt: '#4b4540', fog: '#e5b46e',
        fogNear: 58, fogFar: 170, hemi: 1.02, hemiColor: '#fff1cf', groundLight: '#8c5d31',
        sunIntensity: 1.72, sunColor: '#fff0b0',
      };
    case 'snow':
      return {
        skyTint: '#d9efff', ground: '#d8e6ed', asphalt: '#4d5962', fog: '#c9dfeb',
        fogNear: 45, fogFar: 145, hemi: 1.05, hemiColor: '#f2fbff', groundLight: '#9eafb8',
        sunIntensity: 0.9, sunColor: '#e7f7ff',
      };
    case 'neon':
      return {
        skyTint: '#24184a', ground: '#101a32', asphalt: '#171a28', fog: '#291d52',
        fogNear: 48, fogFar: 152, hemi: 0.58, hemiColor: '#63dcff', groundLight: '#15102c',
        sunIntensity: 0.4, sunColor: '#ff4ec4',
      };
    case 'volcano':
      return {
        skyTint: '#5d2420', ground: '#261d1b', asphalt: '#242020', fog: '#6e2b1f',
        fogNear: 40, fogFar: 128, hemi: 0.5, hemiColor: '#ff8a4b', groundLight: '#23120e',
        sunIntensity: 0.48, sunColor: '#ff5b21',
      };
    case 'sunset':
    default:
      return {
        skyTint: '#ffffff', ground: '#57b94a', asphalt: '#41454c', fog: '#8fc7f5',
        fogNear: 60, fogFar: 190, hemi: 0.95, hemiColor: '#eaf6ff', groundLight: '#4e7a3a',
        sunIntensity: 1.5, sunColor: '#fff0d0',
      };
  }
}
