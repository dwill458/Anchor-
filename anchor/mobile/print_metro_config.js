const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
console.log(JSON.stringify(config.resolver.sourceExts, null, 2));
