import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

/**
 * Bakes the extracted vehicle PNGs into raw RGBA blobs the app can upload
 * without any native image decoding.
 *
 * Expo GL's `texImage2D({ localUri })` path hands the file to a bundled stb
 * decoder on the render thread. When that decode returns nothing the storage
 * three.js already allocated is left untouched, so the sampler reads pure black
 * with no GL error and no JS exception - which is exactly how a blue car turns
 * out matte black. A real `Uint8Array` goes through Expo GL's typed-array
 * branch instead, which is the same path every other buffer upload uses.
 *
 * Output layout: `u32 width, u32 height` little-endian, then width*height RGBA
 * bytes in top-to-bottom row order (matching glTF's top-left UV origin).
 *
 * Run with: node scripts/build-vehicle-raw-textures.mjs
 */

const MODELS_DIR = 'assets/game-models';

/** 1024 keeps the paint detail readable while the car is a few hundred px tall. */
export const MAX_SIZE = 1024;

/**
 * Converts one extracted PNG into the runtime RGBA blob, returning the blob's
 * average colour so the material's fallback paint can be kept in step with it.
 */
export async function buildRawTexture(pngPath, outputPath, maxSize = MAX_SIZE) {
  const image = decodePng(await fs.readFile(pngPath));
  const scaled = downsample(image, maxSize);

  const header = Buffer.alloc(8);
  header.writeUInt32LE(scaled.width, 0);
  header.writeUInt32LE(scaled.height, 4);
  await fs.writeFile(outputPath, Buffer.concat([header, scaled.data]));

  const stat = await fs.stat(outputPath);
  const summary = {
    sourceSize: `${image.width}x${image.height}`,
    outputSize: `${scaled.width}x${scaled.height}`,
    megabytes: Number((stat.size / 1024 / 1024).toFixed(2)),
    averageColor: `#${averageColor(scaled)}`,
  };

  console.log(
    `[vehicle-raw] ${path.basename(pngPath)} ${summary.sourceSize} -> ${path.basename(outputPath)} ` +
      `${summary.outputSize}, ${summary.megabytes} MB, averageColor=${summary.averageColor}`,
  );
  return summary;
}

/** Standalone entry point, for rebuilding blobs without rerunning the optimizer. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildRawTexture(
    path.join(MODELS_DIR, 'blueCompressed_m0_baseColor.png'),
    path.join(MODELS_DIR, 'blueCompressed_m0_baseColor.rgba.bin'),
  );
}

/** Minimal 8-bit PNG reader: enough for the non-interlaced maps this repo ships. */
function decodePng(file) {
  if (file.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG file');

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const bitDepth = file[24];
  const colorType = file[25];
  const interlace = file[28];

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  if (interlace !== 0) throw new Error('Interlaced PNGs are not supported');

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`Unsupported PNG colour type: ${colorType}`);

  const chunks = [];
  for (let offset = 8; offset < file.length; ) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(file.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }

  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);

  // Undo the per-scanline PNG filters (spec section 9.2).
  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    const line = raw.subarray(read, read + stride);
    read += stride;

    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const previous = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous ? previous[x] : 0;
      const upLeft = previous && x >= channels ? previous[x - channels] : 0;
      let value = line[x];

      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);

      row[x] = value & 0xff;
    }
  }

  return { width, height, data: toRgba(pixels, width, height, channels) };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function toRgba(pixels, width, height, channels) {
  if (channels === 4) return pixels;

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, o = 0; o < rgba.length; i += channels, o += 4) {
    if (channels === 3) {
      rgba[o] = pixels[i];
      rgba[o + 1] = pixels[i + 1];
      rgba[o + 2] = pixels[i + 2];
      rgba[o + 3] = 255;
    } else {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = pixels[i];
      rgba[o + 3] = channels === 2 ? pixels[i + 1] : 255;
    }
  }
  return rgba;
}

/**
 * Box filter down to `maxSize`. Colour is averaged in linear space so the
 * result keeps the authored paint brightness instead of drifting dark.
 */
function downsample(image, maxSize) {
  const factor = Math.ceil(Math.max(image.width, image.height) / maxSize);
  if (factor <= 1) return image;

  const width = Math.max(1, Math.floor(image.width / factor));
  const height = Math.max(1, Math.floor(image.height / factor));
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let samples = 0;

      for (let sy = y * factor; sy < Math.min((y + 1) * factor, image.height); sy++) {
        for (let sx = x * factor; sx < Math.min((x + 1) * factor, image.width); sx++) {
          const i = (sy * image.width + sx) * 4;
          r += srgbToLinear(image.data[i]);
          g += srgbToLinear(image.data[i + 1]);
          b += srgbToLinear(image.data[i + 2]);
          a += image.data[i + 3];
          samples++;
        }
      }

      const o = (y * width + x) * 4;
      data[o] = linearToSrgb(r / samples);
      data[o + 1] = linearToSrgb(g / samples);
      data[o + 2] = linearToSrgb(b / samples);
      data[o + 3] = Math.round(a / samples);
    }
  }

  return { width, height, data };
}

function srgbToLinear(byte) {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearToSrgb(value) {
  const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}

/** Reported so the runtime fallback colour can be kept in step with the map. */
function averageColor({ data }) {
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += srgbToLinear(data[i]);
    g += srgbToLinear(data[i + 1]);
    b += srgbToLinear(data[i + 2]);
  }
  return [r, g, b]
    .map((channel) => linearToSrgb(channel / pixels).toString(16).padStart(2, '0'))
    .join('');
}
