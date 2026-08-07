import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const INPUT_DIR = 'assets/new-models';
const OUTPUT_DIR = 'assets/game-models';

// Models already compressed to roughly this range are considered game-ready.
// Do NOT decimate or weld them again — preserve the authored car shape exactly.
const MOBILE_READY_MAX_TRIANGLES = 35000;

// Only very heavy source models are simplified, and even then conservatively.
const HEAVY_MODEL_TARGET_TRIANGLES = 45000;

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
  const alreadyMobileReady = beforeTriangles <= MOBILE_READY_MAX_TRIANGLES;

  // Bake the authored base-colour texture into vertex colours. This keeps the
  // painted look while avoiding React Native / Expo GL image-texture decoding.
  await bakeBaseColorToVertexColors(document, buffer);

  // One simple material for every primitive = cheap clones and very few draw
  // calls. Vertex colours carry the appearance, so no texture maps are needed.
  const gameMaterial = document
    .createMaterial('mobile-vertex-color')
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0.02)
    .setRoughnessFactor(0.78)
    .setDoubleSided(false);

  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(gameMaterial);
  }

  if (alreadyMobileReady) {
    // Important: a hand-compressed ~30k car is already where we want it.
    // No weld() and no simplify(): keep every remaining silhouette/detail edge.
    await document.transform(dedup(), prune());
  } else {
    // Heavy Meshy sources still need geometry reduction before runtime.
    await document.transform(dedup(), weld({ toleranceNormal: 0.05 }), prune());

    const currentTriangles = countTriangles(document);
    if (currentTriangles > HEAVY_MODEL_TARGET_TRIANGLES * 1.15) {
      const ratio = Math.max(0.05, Math.min(0.95, HEAVY_MODEL_TARGET_TRIANGLES / currentTriangles));
      await document.transform(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio,
          error: 0.0008,
          lockBorder: true,
        }),
      );
    }
  }

  // Flatten and join after geometry decisions. This preserves the visible
  // geometry while collapsing compatible primitives into a cheaper runtime mesh.
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
    `[vehicle-opt] ${file}: ${beforeTriangles.toLocaleString()} -> ${afterTriangles.toLocaleString()} tris, ${(stat.size / 1024).toFixed(0)} KB${alreadyMobileReady ? ' (geometry preserved)' : ''}`,
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
