const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('html')) {
  config.resolver.assetExts.push('html');
}

config.resolver.blockList = [
  /node_modules\/.*\/android\/\.cxx\/.*/,
  // Only native build outputs inside packages. A bare `build/` rule also hides every package's JS `build/` folder
  // (e.g. expo-asset/build/index.js) on POSIX builders such as EAS, where it breaks bundling.
  /node_modules\/(@[^/]+\/)?[^/]+\/(android|ios)\/build\/.*/,
  /android\/\.cxx\/.*/,
  /android\/build\/.*/,
  /android\/app\/build\/.*/,
  /ios\/build\/.*/,
  /ios\/Pods\/.*/,
  /\.visualize-cinematic.*/,
];

module.exports = config;
