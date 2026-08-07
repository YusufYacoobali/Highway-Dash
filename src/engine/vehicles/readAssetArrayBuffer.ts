import type { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Legacy from 'expo-file-system/legacy';

/**
 * Reads a bundled binary asset into an `ArrayBuffer`.
 *
 * `fetch` cannot be used here: on Android the bundled asset lives inside the
 * APK and is served through a `file://`-like URI that OkHttp refuses. The
 * modern `File` API handles both platforms, with the legacy base64 route kept
 * as a fallback for older runtimes.
 */
export async function readAssetArrayBuffer(asset: Asset): Promise<ArrayBuffer> {
  if (!asset.downloaded) await asset.downloadAsync();

  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error(`Asset ${asset.name} has no resolvable URI`);

  try {
    return await new File(uri).arrayBuffer();
  } catch {
    const base64 = await Legacy.readAsStringAsync(uri, {
      encoding: Legacy.EncodingType.Base64,
    });
    return base64ToArrayBuffer(base64);
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Self-contained decoder so the loader never depends on an `atob` polyfill. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((clean.length * 3) / 4 - padding);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk =
      (BASE64_ALPHABET.indexOf(clean[i]) << 18) |
      (BASE64_ALPHABET.indexOf(clean[i + 1]) << 12) |
      (BASE64_ALPHABET.indexOf(clean[i + 2]) << 6) |
      BASE64_ALPHABET.indexOf(clean[i + 3]);

    if (byteIndex < bytes.length) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes.buffer;
}
