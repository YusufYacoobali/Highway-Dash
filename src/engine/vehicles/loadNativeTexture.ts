import { Asset } from 'expo-asset';
import { Image } from 'react-native';
import {
  LinearFilter,
  LinearMipmapLinearFilter,
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
 * The image pixels themselves are not modified in any way.
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

  // glTF textures use UV origin conventions opposite Three's normal image
  // loader, so GLTFLoader always uses flipY=false. Preserve that behaviour.
  texture.flipY = false;
  texture.colorSpace = colorSpace === 'srgb' ? SRGBColorSpace : NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}
