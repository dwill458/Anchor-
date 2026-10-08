import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, DevSettings, Linking, Modal, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { V2ChartPreview } from './V2ChartPreview';
import { resetAllTeachingSeen } from '@/hooks/v2/teaching/teachingSeen';
import { TEACHING_COPY } from '@/constants/v2/teachingCopy';
import { useAuthStore } from '@/stores/authStore';

/**
 * Development only: adds "Chart motion lab" to the React Native dev menu and
 * presents the lab full-screen over whatever is showing. Never mounted in
 * release builds (App renders it behind __DEV__).
 */
export function ChartLabDevHost() {
  const [open, setOpen] = useState(false);
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const resetTeaching = async (replay: boolean) => {
    await resetAllTeachingSeen(accountId);
    if (replay) {
      setOpen(false);
      DeviceEventEmitter.emit('replayAppTeaching');
    }
  };
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
    const emitterSub = DeviceEventEmitter.addListener('openChartLab', openLab);
    // Dev-only: `adb shell am start -a android.intent.action.VIEW -d anchor://chart-lab` opens the lab
    // (the Expo dev menu keeps only the last registered lab, so this is the reliable way in).
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('chart-lab')) openLab();
    });
    return () => {
      emitterSub.remove();
      linkSub.remove();
    };
  }, []);
  return (
    <Modal visible={open} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
      {/* Android Modals render outside the app root, so gestures need their own root here. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {open ? <V2ChartPreview onClose={() => setOpen(false)} /> : null}
        <View style={{ position: 'absolute', bottom: 30, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#F4EFE6', padding: 8, borderRadius: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => { void resetTeaching(true); }} style={{ padding: 12 }}><Text>{TEACHING_COPY.dev.replay}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { void resetTeaching(false); }} style={{ padding: 12 }}><Text>{TEACHING_COPY.dev.reset}</Text></Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
