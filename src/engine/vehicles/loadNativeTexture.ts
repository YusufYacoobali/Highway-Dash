import { Asset } from 'expo-asset';
import { ClampToEdgeWrapping, DataTexture, LinearFilter, NoColorSpace, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';

import { readAssetArrayBuffer } from './readAssetArrayBuffer';

/** `u32 width, u32 height` little-endian, then tightly packed RGBA rows. */
const HEADER_BYTES = 8;

/**
 * Loads a pre-decoded RGBA blob (see `scripts/build-vehicle-raw-textures.mjs`)
 * into a real `DataTexture`.
 *
 * Handing Expo GL a `{ localUri }` object instead makes it decode the file with
 * its bundled stb copy on the render thread. That decode has no error channel:
 * if it fails, `texSubImage2D` uploads a null pointer over the storage three.js
 * already allocated and every sample comes back pure black - no GL error, no
 * exception, just an unlit-looking car. Uploading bytes we decoded ahead of
 * time removes that failure mode, and any problem here surfaces as a throw.
 */
export async function loadNativeTexture(
  module: number,
  colorSpace: 'srgb' | 'linear',
): Promise<DataTexture> {
  const [asset] = await Asset.loadAsync(module);
  const buffer = await readAssetArrayBuffer(asset);

  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error(`Texture blob ${asset.name} is too small to contain a header`);
  }

  const header = new DataView(buffer);
  const width = header.getUint32(0, true);
  const height = header.getUint32(4, true);
  const expected = width * height * 4;

  if (width === 0 || height === 0 || buffer.byteLength - HEADER_BYTES !== expected) {
    throw new Error(
      `Texture blob ${asset.name} declares ${width}x${height} (${expected} bytes) but carries ${buffer.byteLength - HEADER_BYTES}`,
    );
  }

  const texture = new DataTexture(
    new Uint8Array(buffer, HEADER_BYTES, expected),
    width,
    height,
    RGBAFormat,
    UnsignedByteType,
  );

  // Rows are stored top-first to match glTF's top-left UV origin, which is the
  // same convention GLTFLoader assumes when it disables flipping.
  texture.flipY = false;
  texture.colorSpace = colorSpace === 'srgb' ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
