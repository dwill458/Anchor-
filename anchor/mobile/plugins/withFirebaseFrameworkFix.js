const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Injects CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES into
// the expo-generated post_install block so RNFBApp can include React-Core
// headers while use_frameworks! :linkage => :static is active (required by
// @react-native-firebase v24 / Firebase iOS SDK 11).
//
// NOTE: expo's Podfile has `post_install` indented inside the target block,
// so the match must NOT be anchored to the start of the line.
module.exports = function withFirebaseFrameworkFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return cfg;
      }

      const clangFix = [
        '    # Allow RNFBApp/RNFBAuth to include React-Core headers inside frameworks',
        '    installer.pods_project.targets.each do |target|',
        '      target.build_configurations.each do |config|',
        "        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
        '      end',
        '    end',
      ].join('\n');

      // Match without line anchor — the expo Podfile indents post_install
      // inside the target block so ^ would not match.
      podfile = podfile.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|\n${clangFix}`
      );

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
