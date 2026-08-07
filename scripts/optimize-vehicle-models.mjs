import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const INPUT_DIR = 'assets/new-models';
const OUTPUT_DIR = 'assets/game-models';
const TARGET_TRIANGLES = 9000;

await MeshoptSimplifier.ready;
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = (await fs.readdir(INPUT_DIR)).filter((name) => name.toLowerCase().endsWith('.glb'));

if (!files.length) throw new Error(`No GLBs found in ${INPUT_DIR}`);

for (const file of files) {
  const input = path.join(INPUT_DIR, file);
  const output = path.join(OUTPUT_DIR, file);
  const document = await io.read(input);
  const root = document.getRoot();
  const buffer = root.listBuffers()[0] ?? document.createBuffer('game-buffer');

  const beforeTriangles = countTriangles(document);
  await bakeBaseColorToVertexColors(document, buffer);

  const gameMaterial = document
    .createMaterial('mobile-vertex-color')
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0.02)
    .setRoughnessFactor(0.82)
    .setDoubleSided(false);

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(gameMaterial);
  }

  await document.transform(dedup(), weld({ toleranceNormal: 0.35 }), prune());

  const currentTriangles = countTriangles(document);
  if (currentTriangles > TARGET_TRIANGLES) {
    const ratio = Math.max(0.025, Math.min(0.9, TARGET_TRIANGLES / currentTriangles));
    await document.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio,
        error: 0.0025,
        lockBorder: false,
      }),
    );
  }

  await document.transform(flatten(), join({ keepMeshes: false }), dedup(), prune());

  for (const material of root.listMaterials()) {
    material
      .setBaseColorTexture(null)
      .setMetallicRoughnessTexture(null)
      .setNormalTexture(null)
      .setOcclusionTexture(null)
      .setEmissiveTexture(null);
  }
  await document.transform(prune());

  await io.write(output, document);

  const afterTriangles = countTriangles(document);
  const stat = await fs.stat(output);
  console.log(
    `[vehicle-opt] ${file}: ${beforeTriangles.toLocaleString()} -> ${afterTriangles.toLocaleString()} tris, ${(stat.size / 1024).toFixed(0)} KB`,
  );
}

async function bakeBaseColorToVertexColors(document, buffer) {
  const root = document.getRoot();
  const decoded = new Map();

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;

      const material = primitive.getMaterial();
      const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const texture = material?.getBaseColorTexture() ?? null;
      const uv = primitive.getAttribute('TEXCOORD_0');
      const count = position.getCount();
      const colors = new Float32Array(count * 4);

      let image = null;
      if (texture && uv) {
        if (!decoded.has(texture)) decoded.set(texture, decodeTexture(texture));
        image = await decoded.get(texture);
      }

      const uvValue = [0, 0];
      for (let i = 0; i < count; i++) {
        let r = factor[0];
        let g = factor[1];
        let b = factor[2];
        let a = factor[3];

        if (image && uv) {
          uv.getElement(i, uvValue);
          const sample = sampleImage(image, uvValue[0], uvValue[1]);
          r *= srgbToLinear(sample[0] / 255);
          g *= srgbToLinear(sample[1] / 255);
          b *= srgbToLinear(sample[2] / 255);
          a *= sample[3] / 255;
        }

        const offset = i * 4;
        colors[offset] = r;
        colors[offset + 1] = g;
        colors[offset + 2] = b;
        colors[offset + 3] = a;
      }

      primitive.setAttribute(
        'COLOR_0',
        document
          .createAccessor('baked-base-color')
          .setType('VEC4')
          .setArray(colors)
          .setBuffer(buffer),
      );
    }
  }
}

async function decodeTexture(texture) {
  const bytes = texture.getImage();
  if (!bytes) return null;
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function sampleImage(image, u, v) {
  const uu = ((u % 1) + 1) % 1;
  const vv = ((v % 1) + 1) % 1;
  const x = Math.min(image.width - 1, Math.max(0, Math.round(uu * (image.width - 1))));
  const y = Math.min(image.height - 1, Math.max(0, Math.round((1 - vv) * (image.height - 1))));
  const i = (y * image.width + x) * image.channels;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3] ?? 255];
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function countTriangles(document) {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== 4) continue;
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      triangles += Math.floor((indices?.getCount() ?? position?.getCount() ?? 0) / 3);
    }
  }
  return triangles;
}

// PR trigger used to run the optimizer against repository-hosted binary GLBs.
