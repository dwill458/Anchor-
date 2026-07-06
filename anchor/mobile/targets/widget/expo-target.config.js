/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  name: "AnchorWidget",
  icon: "../../assets/anchor-icon.png",
  // Shares the WidgetSnapshot JSON with the main app (written by the
  // AnchorWidgetBridge local module). Must match WIDGET_APP_GROUP in
  // src/widgets/widgetTypes.ts and the main app's ios.entitlements.
  entitlements: {
    "com.apple.security.application-groups": [
      "group.com.anchorintentions.app.widget",
    ],
  },
});
