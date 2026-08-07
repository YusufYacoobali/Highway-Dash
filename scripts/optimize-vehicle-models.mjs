import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const INPUT_DIR = 'assets/new-models';
const OUTPUT_DIR = 'assets/game-models';
const PRESERVE_EXACT_FILE = 'Meshy_AI_Blue_Bubble_Car_0807173120_texture.glb';
const PRESERVE_PREFIX = 'blueCompressed';

// Models already compressed to roughly this range are considered game-ready.
const MOBILE_READY_MAX_TRIANGLES = 35000;
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

  // This is the currently selected ~30k test car. Preserve its geometry,
  // authored material values and UVs exactly. The only change is packaging:
  // embedded images are extracted as lossless PNGs for Expo GL, then removed
  // from the GLB so GLTFLoader never touches React Native's unsupported Blob
  // image path. Runtime reattaches the exact same pixels to the exact same UVs.
  if (file === PRESERVE_EXACT_FILE) {
    await buildExactTexturePassThrough(document, output);
    continue;
  }

  await buildOptimizedFallback(document, output, file);
}

async function buildExactTexturePassThrough(document, output) {
  const root = document.getRoot();
  const beforeTriangles = countTriangles(document);
  const materials = root.listMaterials();

  // Remove stale extracted textures before recreating the exact current set.
  for (const name of await fs.readdir(OUTPUT_DIR)) {
    if (name.startsWith(`${PRESERVE_PREFIX}_m`) && name.endsWith('.png')) {
      await fs.rm(path.join(OUTPUT_DIR, name), { force: true });
    }
  }

  const slots = [
    ['baseColor', (material) => material.getBaseColorTexture(), (material) => material.setBaseColorTexture(null)],
    ['normal', (material) => material.getNormalTexture(), (material) => material.setNormalTexture(null)],
    [
      'metalRough',
      (material) => material.getMetallicRoughnessTexture(),
      (material) => material.setMetallicRoughnessTexture(null),
    ],
    ['occlusion', (material) => material.getOcclusionTexture(), (material) => material.setOcclusionTexture(null)],
    ['emissive', (material) => material.getEmissiveTexture(), (material) => material.setEmissiveTexture(null)],
  ];

  const extracted = [];
  for (let materialIndex = 0; materialIndex < materials.length; materialIndex++) {
    const material = materials[materialIndex];
    for (const [slot, getter, clear] of slots) {
      const texture = getter(material);
      const bytes = texture?.getImage();
      if (!bytes) continue;

      const filename = `${PRESERVE_PREFIX}_m${materialIndex}_${slot}.png`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      await sharp(bytes).ensureAlpha().png({ compressionLevel: 9 }).toFile(outputPath);
      extracted.push({ materialIndex, materialName: material.getName(), slot, filename });
      clear(material);
    }
  }

  // Only prune now-unreferenced embedded image resources. No geometry/material
  // replacement, flattening, joining, welding, decimation or vertex-colour bake.
  await document.transform(prune());
  await io.write(output, document);

  const afterTriangles = countTriangles(document);
  const stat = await fs.stat(output);
  console.log(
    `[vehicle-exact] ${path.basename(output)}: ${beforeTriangles.toLocaleString()} -> ${afterTriangles.toLocaleString()} tris, ${(stat.size / 1024).toFixed(0)} KB, extracted=${JSON.stringify(extracted)}`,
  );
}

async function buildOptimizedFallback(document, output, file) {
  const root = document.getRoot();
  const buffer = root.listBuffers()[0] ?? document.createBuffer('game-buffer');
  const beforeTriangles = countTriangles(document);
  const alreadyMobileReady = beforeTriangles <= MOBILE_READY_MAX_TRIANGLES;

  await bakeBaseColorToVertexColors(document, buffer);

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
    await document.transform(dedup(), prune());
  } else {
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
