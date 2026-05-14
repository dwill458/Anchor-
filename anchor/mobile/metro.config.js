const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('html')) {
  config.resolver.assetExts.push('html');
}

config.resolver.blockList = exclusionList([
  /node_modules\/.*\/android\/\.cxx\/.*/,
  /android\/\.cxx\/.*/,
  /android\/build\/.*/,
  /android\/app\/build\/.*/,
  /ios\/build\/.*/,
  /ios\/Pods\/.*/,
]);

module.exports = config;
