// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ship glTF binaries and audio through the asset pipeline so `expo-asset`
// can resolve them at runtime on both iOS and Android.
const extraAssetExts = ['glb', 'gltf', 'bin', 'mp3', 'wav'];
for (const ext of extraAssetExts) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

// The mockup sources at the repo root are design references, not app code.
config.resolver.blockList = [/[\\/]screenshots[\\/].*/, /[\\/]support\.js$/, /[\\/]ios-frame\.jsx$/];

module.exports = config;
