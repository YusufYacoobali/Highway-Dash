import { Asset } from 'expo-asset';
import { Image } from 'react-native';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';

/**
 * Load a bundled image into Three without browser Image/Blob APIs.
 *
 * expo-gl accepts `{ localUri }` directly as texImage2D pixel data. Marking the
 * texture as a DataTexture makes Three pass image.data verbatim to expo-gl.
 */
export async function loadNativeTexture(
  module: number,
  colorSpace: 'srgb' | 'linear',
): Promise<Texture> {
  const [asset] = await Asset.loadAsync(module);
  const localUri = asset.localUri;
  if (!localUri) throw new Error(`Texture asset did not resolve to a local file: ${asset.uri}`);

  const { width, height } = await imageSize(localUri);
  const texture = new Texture();

  (texture as Texture & { isDataTexture: boolean }).isDataTexture = true;
  texture.image = {
    data: { localUri },
    width,
    height,
  };

  // Match GLTFLoader's UV convention.
  texture.flipY = false;
  texture.colorSpace = colorSpace === 'srgb' ? SRGBColorSpace : NoColorSpace;

  // Expo GL is much more reliable when native file-backed textures do not need
  // generated mipmaps. Mipmap/repeat requirements can otherwise leave an
  // incomplete texture that samples pure black on WebGL1-class devices.
  const powerOfTwo = isPowerOfTwo(width) && isPowerOfTwo(height);
  texture.wrapS = powerOfTwo ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = powerOfTwo ? RepeatWrapping : ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}
