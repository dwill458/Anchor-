/**
 * AnchorWidgetBridge — JS API for the iOS local Expo module that writes the
 * widget snapshot JSON into the shared App Group UserDefaults and reloads
 * WidgetKit timelines.
 *
 * Android does not use this module — widget updates go through
 * react-native-android-widget's requestWidgetUpdate instead.
 */

import { Platform } from 'react-native';

/**
 * Writes the snapshot JSON to the shared App Group and reloads all widget
 * timelines. Returns false (never throws) when unavailable — e.g. Android,
 * or an iOS dev client built before this module existed.
 */
export function setWidgetSnapshot(json: string): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    // Lazy require: keeps startup safe on binaries without the native module.
    const { requireNativeModule } = require('expo-modules-core');
    const nativeModule = requireNativeModule('AnchorWidgetBridge');
    return nativeModule.setWidgetSnapshot(json) === true;
  } catch {
    return false;
  }
}
