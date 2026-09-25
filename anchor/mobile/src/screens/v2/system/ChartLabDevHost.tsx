import React, { useEffect, useState } from 'react';
import { DevSettings, Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { V2ChartPreview } from './V2ChartPreview';

/**
 * Development only: adds "Chart motion lab" to the React Native dev menu and
 * presents the lab full-screen over whatever is showing. Never mounted in
 * release builds (App renders it behind __DEV__).
 */
export function ChartLabDevHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const openLab = () => setOpen(true);
    DevSettings.addMenuItem?.('Chart motion lab', openLab);
    // The Expo dev client has its own menu; register there too (dev-only, loaded lazily).
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const devMenu = require('expo-dev-menu') as { registerDevMenuItems?: (items: { name: string; callback: () => void; shouldCollapse?: boolean }[]) => Promise<void> };
      void devMenu.registerDevMenuItems?.([{ name: 'Chart motion lab', callback: openLab, shouldCollapse: true }]);
    } catch {
      // Not running in a dev client.
    }
  }, []);
  return (
    <Modal visible={open} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
      {/* Android Modals render outside the app root, so gestures need their own root here. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {open ? <V2ChartPreview onClose={() => setOpen(false)} /> : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
