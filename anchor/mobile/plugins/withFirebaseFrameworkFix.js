const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Adds `use_modular_headers!` to the Podfile so that Swift pods
// (FirebaseCoreInternal, GoogleUtilities) generate module maps.
// This fixes the pod install error with @react-native-firebase v24 /
// Firebase iOS SDK 11 without enabling use_frameworks!, which would
// cause RNFBApp to fail to compile due to non-modular React-Core headers.
module.exports = function withFirebaseFrameworkFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes('use_modular_headers!')) {
        return cfg;
      }

      // Insert after the platform declaration line e.g. "platform :ios, '15.1'"
      podfile = podfile.replace(
        /(platform :ios,[^\n]+\n)/,
        `$1use_modular_headers!\n`
      );

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
