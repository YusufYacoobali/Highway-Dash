import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
} from 'three';

import { ROAD_LENGTH, ROAD_WIDTH } from '@/engine/config';
import type { ScrollBand } from './ScrollBand';

/**
 * Strip counts are deliberately low. Every dash and barrier is its own draw
 * call — they share geometry but three still issues one call each — and the
 * expo-gl bridge charges real time per call, so density is traded for spacing
 * that reads the same at speed.
 */
const DASH_LANES = [-3, 0, 3];
const DASH_COUNT = 13;
const DASH_SPACING = 16;
const DASH_LENGTH = 5;

const BARRIER_COUNT = 17;
const BARRIER_SPACING = 10.8;
const BARRIER_LENGTH = 9.6;

/** Static asphalt plus the two recycled strips that sell forward motion. */
export function buildRoad(scene: Scene): ScrollBand[] {
  const grass = new Mesh(
    new PlaneGeometry(400, ROAD_LENGTH),
    new MeshLambertMaterial({ color: 0x57b94a }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.06, -180);
  scene.add(grass);

  const asphalt = new Mesh(
    new PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH),
    new MeshLambertMaterial({ color: 0x41454c }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, -180);
  scene.add(asphalt);

  const shoulderMaterial = new MeshLambertMaterial({ color: 0xf2f1ec });
  for (const x of [-ROAD_WIDTH / 2 + 0.32, ROAD_WIDTH / 2 - 0.32]) {
    const shoulder = new Mesh(new PlaneGeometry(0.42, ROAD_LENGTH), shoulderMaterial);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(x, 0.02, -180);
    scene.add(shoulder);
  }

  return [buildDashes(scene), buildBarriers(scene)];
}

function buildDashes(scene: Scene): ScrollBand {
  const geometry = new PlaneGeometry(0.28, DASH_LENGTH);
  const material = new MeshBasicMaterial({ color: 0xf4f3ee });
  const objects: Mesh[] = [];

  for (const laneX of DASH_LANES) {
    for (let i = 0; i < DASH_COUNT; i++) {
      const dash = new Mesh(geometry, material);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(laneX, 0.03, 10 - i * DASH_SPACING);
      scene.add(dash);
      objects.push(dash);
    }
  }

  return { objects, period: DASH_COUNT * DASH_SPACING, threshold: 14 };
}

function buildBarriers(scene: Scene): ScrollBand {
  const geometry = new BoxGeometry(0.7, 1.1, BARRIER_LENGTH);
  const white = new MeshLambertMaterial({ color: 0xf2f1ec });
  const red = new MeshLambertMaterial({ color: 0xe0503f });
  const objects: Mesh[] = [];

  for (const x of [-ROAD_WIDTH / 2 - 0.6, ROAD_WIDTH / 2 + 0.6]) {
    for (let i = 0; i < BARRIER_COUNT; i++) {
      const block = new Mesh(geometry, i % 2 ? red : white);
      block.position.set(x, 0.55, 10 - i * BARRIER_SPACING);
      scene.add(block);
      objects.push(block);
    }
  }

  return { objects, period: BARRIER_COUNT * BARRIER_SPACING, threshold: 14 };
}
