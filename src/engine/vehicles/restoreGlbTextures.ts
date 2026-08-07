import { File, Paths } from 'expo-file-system';
import { Image } from 'react-native';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  MirroredRepeatWrapping,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  type Material,
  type MeshStandardMaterial,
  type Wrapping,
} from 'three';

interface GltfParserLike {
  getDependency(type: string, index: number): Promise<Material>;
}

interface BufferViewDef {
  buffer?: number;
  byteOffset?: number;
  byteLength: number;
}

interface ImageDef {
  bufferView?: number;
  mimeType?: string;
}

interface TextureDef {
  source?: number;
  sampler?: number;
  extensions?: {
    KHR_texture_basisu?: { source?: number };
  };
}

interface SamplerDef {
  wrapS?: number;
  wrapT?: number;
}

interface TextureTransformDef {
  offset?: [number, number];
  scale?: [number, number];
  rotation?: number;
  texCoord?: number;
}

interface TextureInfoDef {
  index: number;
  texCoord?: number;
  extensions?: {
    KHR_texture_transform?: TextureTransformDef;
  };
}

interface MaterialDef {
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: TextureInfoDef;
  };
}

interface GlbJson {
  bufferViews?: BufferViewDef[];
  images?: ImageDef[];
  textures?: TextureDef[];
  samplers?: SamplerDef[];
  materials?: MaterialDef[];
}

interface ParsedGlb {
  json: GlbJson;
  binary: Uint8Array;
}

interface NativeTextureImage {
  /** expo-gl texImage2D accepts a file-backed object with localUri. */
  data: { localUri: string };
  width: number;
  height: number;
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/**
 * Restore only the baked colour texture on native Expo GL.
 *
 * GLTFLoader can build the geometry/material graph under React Native, but its
 * browser image path cannot upload embedded GLB images to expo-gl. Expo GL's
 * native texImage2D bridge expects `{ localUri }`, so embedded images are
 * extracted once to cache and fed to Three as DataTextures.
 *
 * We intentionally skip normal/metallic/roughness/AO maps for traffic. These
 * Meshy cars are fairly detailed already and one colour map gives almost all
 * of the visual identity for a fraction of the mobile fragment-shader cost.
 */
export async function restoreEmbeddedGlbTextures(
  buffer: ArrayBuffer,
  parser: GltfParserLike,
  cacheKey: string,
): Promise<void> {
  const parsed = parseGlb(buffer);
  if (!parsed) return;

  const materials = parsed.json.materials ?? [];
  if (materials.length === 0) return;

  const imageCache = new Map<number, Promise<NativeTextureImage | null>>();

  for (let materialIndex = 0; materialIndex < materials.length; materialIndex++) {
    const definition = materials[materialIndex];
    const material = (await parser.getDependency('material', materialIndex)) as MeshStandardMaterial;
    const pbr = definition.pbrMetallicRoughness;
    const factor = pbr?.baseColorFactor;

    if (factor) {
      material.color.setRGB(factor[0], factor[1], factor[2]);
      material.opacity = factor[3];
      if (factor[3] < 1) material.transparent = true;
    }

    if (pbr?.baseColorTexture) {
      material.map = await makeTexture(parsed, pbr.baseColorTexture, imageCache, cacheKey, true);
    }

    // If a native texture cannot be restored, at least keep the authored model
    // visually identifiable rather than rendering every car as clay grey.
    if (!material.map) material.color.setHex(fallbackColor(cacheKey));

    // Mobile traffic optimisation: keep a single baked albedo sample and use
    // cheap scalar PBR values. Geometry is unchanged and textures stay crisp.
    material.normalMap = null;
    material.aoMap = null;
    material.metalnessMap = null;
    material.roughnessMap = null;
    material.emissiveMap = null;
    material.metalness = 0.05;
    material.roughness = 0.78;
    material.needsUpdate = true;
  }
}

async function makeTexture(
  parsed: ParsedGlb,
  info: TextureInfoDef,
  imageCache: Map<number, Promise<NativeTextureImage | null>>,
  cacheKey: string,
  srgb: boolean,
): Promise<Texture | null> {
  const textureDef = parsed.json.textures?.[info.index];
  if (!textureDef) return null;

  const imageIndex = textureDef.source ?? textureDef.extensions?.KHR_texture_basisu?.source;
  if (imageIndex === undefined) return null;

  let pendingImage = imageCache.get(imageIndex);
  if (!pendingImage) {
    pendingImage = loadNativeImage(parsed, imageIndex, cacheKey);
    imageCache.set(imageIndex, pendingImage);
  }

  const image = await pendingImage;
  if (!image) return null;

  const texture = new Texture();
  // Forces Three's WebGLTextures path to pass `image.data` directly to
  // gl.texImage2D. `image.data` is exactly `{ localUri }`, the shape expo-gl
  // documents for native image uploads.
  (texture as Texture & { isDataTexture: boolean }).isDataTexture = true;
  texture.image = image;
  texture.flipY = false;
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.channel = info.extensions?.KHR_texture_transform?.texCoord ?? info.texCoord ?? 0;
  texture.generateMipmaps = false;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;

  applyWrapping(texture, parsed.json.samplers?.[textureDef.sampler ?? -1]);
  applyTransform(texture, info.extensions?.KHR_texture_transform);
  texture.needsUpdate = true;
  return texture;
}

async function loadNativeImage(
  parsed: ParsedGlb,
  imageIndex: number,
  cacheKey: string,
): Promise<NativeTextureImage | null> {
  const imageDef = parsed.json.images?.[imageIndex];
  if (!imageDef || imageDef.bufferView === undefined) return null;

  const view = parsed.json.bufferViews?.[imageDef.bufferView];
  if (!view || (view.buffer ?? 0) !== 0) return null;

  const start = view.byteOffset ?? 0;
  const end = start + view.byteLength;
  if (start < 0 || end > parsed.binary.byteLength) return null;

  const extension = extensionForMime(imageDef.mimeType);
  if (!extension) {
    console.warn(`[HighwayDash] Unsupported embedded texture type: ${imageDef.mimeType ?? 'unknown'}`);
    return null;
  }

  const safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = new File(Paths.cache, `highway-${safeKey}-texture-${imageIndex}.${extension}`);
  file.create({ overwrite: true, intermediates: true });
  file.write(parsed.binary.slice(start, end));

  const { width, height } = await imageSize(file.uri);
  return { data: { localUri: file.uri }, width, height };
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

function parseGlb(buffer: ArrayBuffer): ParsedGlb | null {
  if (buffer.byteLength < 20) return null;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;

  let offset = 12;
  let json: GlbJson | null = null;
  let binary: Uint8Array | null = null;

  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    if (dataEnd > buffer.byteLength) return null;

    if (chunkType === JSON_CHUNK) {
      const text = new TextDecoder().decode(new Uint8Array(buffer, dataStart, chunkLength));
      json = JSON.parse(text.replace(/\u0000+$/g, '').trimEnd()) as GlbJson;
    } else if (chunkType === BIN_CHUNK) {
      binary = new Uint8Array(buffer, dataStart, chunkLength);
    }

    offset = dataEnd;
  }

  return json && binary ? { json, binary } : null;
}

function extensionForMime(mimeType?: string): string | null {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

function applyTransform(texture: Texture, transform?: TextureTransformDef): void {
  if (!transform) return;
  if (transform.offset) texture.offset.set(transform.offset[0], transform.offset[1]);
  if (transform.scale) texture.repeat.set(transform.scale[0], transform.scale[1]);
  if (transform.rotation !== undefined) texture.rotation = transform.rotation;
}

function applyWrapping(texture: Texture, sampler?: SamplerDef): void {
  texture.wrapS = sampler?.wrapS ? wrapping(sampler.wrapS) : RepeatWrapping;
  texture.wrapT = sampler?.wrapT ? wrapping(sampler.wrapT) : RepeatWrapping;
}

function wrapping(value: number): Wrapping {
  switch (value) {
    case 33071:
      return ClampToEdgeWrapping;
    case 33648:
      return MirroredRepeatWrapping;
    case 10497:
    default:
      return RepeatWrapping;
  }
}

function fallbackColor(cacheKey: string): number {
  switch (cacheKey) {
    case 'redBubble':
      return 0xe53935;
    case 'blueBubble':
      return 0x2f7fe8;
    case 'azureVelocity':
    default:
      return 0x31a7ff;
  }
}
