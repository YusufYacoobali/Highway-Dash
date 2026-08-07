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

const DASH_LANES = [-3, 0, 3] as const;
const DASH_COUNT = 13;
const DASH_SPACING = 16;
const DASH_LENGTH = 5;

const BARRIER_COUNT = 17;
const BARRIER_SPACING = 10.8;
const BARRIER_LENGTH = 9.6;

export interface RoadBuild {
  bands: ScrollBand[];
  dashColumns: Mesh[][];
}

/** Static asphalt plus recycled motion strips and handles for lane-layout changes. */
export function buildRoad(scene: Scene): RoadBuild {
  const grass = new Mesh(
    new PlaneGeometry(400, ROAD_LENGTH),
    new MeshLambertMaterial({ color: 0x57b94a }),
  );
  grass.name = 'world-ground';
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.06, -180);
  scene.add(grass);

  const asphalt = new Mesh(
    new PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH),
    new MeshLambertMaterial({ color: 0x41454c }),
  );
  asphalt.name = 'world-asphalt';
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, -180);
  scene.add(asphalt);

  const shoulderMaterial = new MeshLambertMaterial({ color: 0xf2f1ec });
  for (const x of [-ROAD_WIDTH / 2 + 0.32, ROAD_WIDTH / 2 - 0.32]) {
    const shoulder = new Mesh(new PlaneGeometry(0.42, ROAD_LENGTH), shoulderMaterial);
    shoulder.name = 'world-shoulder';
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(x, 0.02, -180);
    scene.add(shoulder);
  }

  const dashes = buildDashes(scene);
  return {
    bands: [dashes.band, buildBarriers(scene)],
    dashColumns: dashes.columns,
  };
}

function buildDashes(scene: Scene): { band: ScrollBand; columns: Mesh[][] } {
  const geometry = new PlaneGeometry(0.28, DASH_LENGTH);
  const material = new MeshBasicMaterial({ color: 0xf4f3ee });
  const objects: Mesh[] = [];
  const columns: Mesh[][] = DASH_LANES.map(() => []);

  DASH_LANES.forEach((laneX, columnIndex) => {
    for (let i = 0; i < DASH_COUNT; i++) {
      const dash = new Mesh(geometry, material);
      dash.name = 'world-lane-dash';
      dash.userData.columnIndex = columnIndex;
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(laneX, 0.03, 10 - i * DASH_SPACING);
      scene.add(dash);
      objects.push(dash);
      columns[columnIndex].push(dash);
    }
  });

  return {
    band: { objects, period: DASH_COUNT * DASH_SPACING, threshold: 14 },
    columns,
  };
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
