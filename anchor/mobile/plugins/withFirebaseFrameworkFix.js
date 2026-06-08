const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// Injects CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES so that
// RNFBApp can include React-Core headers while use_frameworks! :linkage =>
// :static is active (required by Firebase iOS SDK 11 / @react-native-firebase v24).
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

      const clangFix = [
        '  # Allow RNFBApp/RNFBAuth to include React-Core headers inside frameworks',
        '  installer.pods_project.targets.each do |target|',
        '    target.build_configurations.each do |config|',
        "      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
        '    end',
        '  end',
      ].join('\n');

      // Strategy 1: insert after react_native_post_install(...) call
      const rnPostInstallMatch = podfile.match(/react_native_post_install\([\s\S]*?\)/);
      if (rnPostInstallMatch) {
        const insertAt = podfile.indexOf(rnPostInstallMatch[0]) + rnPostInstallMatch[0].length;
        podfile = podfile.slice(0, insertAt) + '\n' + clangFix + podfile.slice(insertAt);
        fs.writeFileSync(podfilePath, podfile);
        return cfg;
      }

      // Strategy 2: insert before the closing `end` of the last post_install block
      const lastEnd = podfile.lastIndexOf('\nend');
      if (lastEnd !== -1) {
        podfile = podfile.slice(0, lastEnd) + '\n' + clangFix + podfile.slice(lastEnd);
        fs.writeFileSync(podfilePath, podfile);
      }

      return cfg;
    },
  ]);
};
