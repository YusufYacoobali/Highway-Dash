import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  Scene,
} from 'three';

import { randomRange, randomSign } from '@/core/math';
import type { ScrollBand } from './ScrollBand';

const TREE_COUNT = 16;
const TREE_SPACING = 15;
const LEAF_COLORS = [0x3f9e33, 0x4fbf3f, 0x358c2e];

/** Roadside low-poly scenery. Themes recolor these shared silhouettes cheaply. */
export function buildScenery(scene: Scene): ScrollBand {
  const trunkMaterial = new MeshLambertMaterial({ color: 0x8b5a2b });
  const leafMaterials = LEAF_COLORS.map((color) => new MeshLambertMaterial({ color }));
  const trunkGeometry = new CylinderGeometry(0.32, 0.42, 2.2, 5);
  const leafGeometry = new IcosahedronGeometry(2.5, 0);
  const objects: Group[] = [];

  const placeSideways = (tree: Group) => {
    tree.position.x = randomSign() * randomRange(10, 26);
  };

  for (let i = 0; i < TREE_COUNT; i++) {
    const tree = new Group();
    tree.name = 'world-tree';

    const trunk = new Mesh(trunkGeometry, trunkMaterial);
    trunk.name = 'world-tree-trunk';
    trunk.position.y = 1.1;

    const leaves = new Mesh(leafGeometry, leafMaterials[i % leafMaterials.length]);
    leaves.name = 'world-tree-leaves';
    leaves.userData.paletteIndex = i % leafMaterials.length;
    leaves.position.y = 3.6;
    leaves.scale.set(1, 1.15, 1);

    tree.add(trunk, leaves);
    tree.position.set(
      (i % 2 ? 1 : -1) * randomRange(10, 26),
      0,
      8 - i * TREE_SPACING - randomRange(0, 5),
    );
    tree.rotation.y = Math.random() * Math.PI * 2;
    tree.scale.setScalar(randomRange(0.85, 1.45));

    scene.add(tree);
    objects.push(tree);
  }

  return {
    objects,
    period: TREE_COUNT * TREE_SPACING + 6,
    threshold: 16,
    onWrap: (object) => placeSideways(object as Group),
  };
}
