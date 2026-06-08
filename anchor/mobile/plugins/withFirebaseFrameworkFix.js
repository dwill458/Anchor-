const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Adds CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES to every
// pod target so that RNFBApp can include React-Core headers while
// use_frameworks! :linkage => :static is active (required by Firebase iOS SDK 11).
module.exports = function withFirebaseFrameworkFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const hook = `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
end
`;

      if (!podfile.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        podfile += hook;
        fs.writeFileSync(podfilePath, podfile);
      }

      return cfg;
    },
  ]);
};
