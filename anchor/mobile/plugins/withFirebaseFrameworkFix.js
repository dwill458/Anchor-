const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Appends a post_install hook that sets
// CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES on every pod
// target so RNFBApp can include React-Core headers while
// use_frameworks! :linkage => :static is active (required by Firebase iOS
// SDK 11 / @react-native-firebase v24).
// CocoaPods accumulates all post_install blocks and runs them in order,
// so appending a second block is safe.
module.exports = function withFirebaseFrameworkFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return cfg;
      }

      podfile += `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
end
`;

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
