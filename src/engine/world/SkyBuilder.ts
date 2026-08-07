import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  RGBAFormat,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { randomRange, randomSign } from '@/core/math';

interface GradientStop {
  offset: number;
  color: string;
}

/** Sunset ramp copied from the mockup's canvas gradient. */
const SKY_STOPS: readonly GradientStop[] = [
  { offset: 0, color: '#1F7FE0' },
  { offset: 0.42, color: '#5FB8F5' },
  { offset: 0.68, color: '#FFC46B' },
  { offset: 0.85, color: '#FF9A4D' },
  { offset: 1, color: '#FFD79A' },
];

const GRADIENT_HEIGHT = 256;

/**
 * React Native has no 2D canvas, so the vertical gradient is rasterised
 * directly into a `DataTexture` instead of being painted and uploaded.
 */
function buildGradientTexture(stops: readonly GradientStop[]): DataTexture {
  const data = new Uint8Array(GRADIENT_HEIGHT * 4);
  const colors = stops.map((stop) => new Color(stop.color));

  for (let y = 0; y < GRADIENT_HEIGHT; y++) {
    const t = y / (GRADIENT_HEIGHT - 1);
    let upper = stops.length - 1;
    while (upper > 0 && stops[upper - 1].offset > t) upper -= 1;
    const lower = Math.max(0, upper - 1);

    const span = stops[upper].offset - stops[lower].offset || 1;
    const local = Math.min(1, Math.max(0, (t - stops[lower].offset) / span));
    const color = colors[lower].clone().lerp(colors[upper], local);

    const i = y * 4;
    data[i] = Math.round(color.r * 255);
    data[i + 1] = Math.round(color.g * 255);
    data[i + 2] = Math.round(color.b * 255);
    data[i + 3] = 255;
  }

  const texture = new DataTexture(data, 1, GRADIENT_HEIGHT, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const SKYLINE_COLORS = [0x6b5ca5, 0x7c6bb8];

/**
 * The backdrop never moves, so each group of same-coloured shapes is baked into
 * a single merged geometry at start-up. That turns roughly thirty static draw
 * calls per frame into three, for free.
 */
function buildSkyline(): Mesh[] {
  const perColor: BufferGeometry[][] = SKYLINE_COLORS.map(() => []);
  let x = -150;

  while (x < 150) {
    const width = randomRange(6, 18);
    const height = randomRange(14, 54);
    // Leave a gap over the road so the horizon reads as an open highway.
    if (Math.abs(x) > 16) {
      const box = new BoxGeometry(width, height, 6);
      box.translate(x + width / 2, height / 2, randomRange(-204, -178));
      perColor[Math.random() > 0.5 ? 0 : 1].push(box);
    }
    x += width + randomRange(2, 7);
  }

  return perColor.flatMap((geometries, index) => {
    const merged = geometries.length > 0 ? mergeGeometries(geometries) : null;
    if (!merged) return [];
    return [new Mesh(merged, new MeshBasicMaterial({ color: SKYLINE_COLORS[index], fog: false }))];
  });
}

function buildClouds(): Mesh | null {
  const puffs: BufferGeometry[] = [];

  for (let i = 0; i < 4; i++) {
    const originX = randomRange(-130, 130);
    const originY = randomRange(58, 88);
    const originZ = randomRange(-220, -160);

    for (let j = 0; j < 3; j++) {
      const radius = randomRange(5, 10);
      const blob = new SphereGeometry(radius, 8, 6);
      blob.scale(1, 0.62, 1);
      blob.translate(originX + j * radius * 1.1 - radius, originY + randomRange(0, 2), originZ);
      puffs.push(blob);
    }
  }

  const merged = mergeGeometries(puffs);
  return merged ? new Mesh(merged, new MeshBasicMaterial({ color: 0xffe7c9, fog: false })) : null;
}

/** Adds the static backdrop. Nothing here scrolls, so no handles are returned. */
export function buildSky(scene: Scene): void {
  const dome = new Mesh(
    new SphereGeometry(280, 16, 10),
    new MeshBasicMaterial({ map: buildGradientTexture(SKY_STOPS), side: BackSide, fog: false }),
  );
  scene.add(dome);

  const sun = new Mesh(
    new CircleGeometry(13, 20),
    new MeshBasicMaterial({ color: 0xfff2c2, fog: false }),
  );
  sun.position.set(randomSign() * 6, 6, -220);
  scene.add(sun);

  for (const block of buildSkyline()) scene.add(block);

  const clouds = buildClouds();
  if (clouds) scene.add(clouds);
}
