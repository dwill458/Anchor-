const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

// expo-splash-screen sets windowSplashScreenBackground and
// windowSplashScreenAnimatedIcon, but not windowSplashScreenIconBackgroundColor.
// When that attribute is unset, OEM launchers are free to pick their own colour
// for the circular plate the system draws behind the splash icon — Samsung One
// UI reuses the adaptive icon's background, which rendered the launcher mark as
// a purple ring around Anchor's gold splash anchor. Pinning the plate to the
// splash background colour makes it invisible.
//
// The checked-in android/ project already has this; the plugin only matters if
// someone regenerates it with `expo prebuild`.
module.exports = function withAndroidSplashIconBackground(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      name: 'windowSplashScreenIconBackgroundColor',
      value: '@color/splashscreen_background',
      parent: { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' },
    });
    return cfg;
  });
};
