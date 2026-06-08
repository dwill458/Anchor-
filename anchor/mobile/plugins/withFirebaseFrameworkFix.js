const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Injects CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES into the
// existing expo-generated post_install block so that RNFBApp can include
// React-Core headers while use_frameworks! :linkage => :static is active.
module.exports = function withFirebaseFrameworkFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const marker = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';
      if (podfile.includes(marker)) {
        return cfg;
      }

      const injection = `
  # Allow RNFBApp to include non-modular React-Core headers under use_frameworks!
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
`;

      // Insert right after the opening line of the existing post_install block
      podfile = podfile.replace(
        /^(post_install do \|installer\|)/m,
        `$1${injection}`
      );

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
