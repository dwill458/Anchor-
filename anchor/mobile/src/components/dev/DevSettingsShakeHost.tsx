import React, { useEffect, useState } from 'react';
import { Alert, DevSettings, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeveloperToolsSection } from '@/components/settings/DeveloperToolsSection';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Dev-only host for the shake menu. Shaking the device opens the React Native dev menu, which
 * lists the Anchor items registered here: the screenshot toggles and the full Dev settings sheet.
 * Mounted inside the navigation container.
 */
export function DevSettingsShakeHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!__DEV__) return;
    DevSettings.addMenuItem?.('Anchor dev settings', () => setOpen(true));
    DevSettings.addMenuItem?.('Toggle hide dev controls', () => {
      const { devHideDevControls, setDevHideDevControls } = useSettingsStore.getState();
      const next = !devHideDevControls;
      setDevHideDevControls(next);
      Alert.alert('Hide dev controls', next ? 'On: dev pill and model pickers hidden.' : 'Off: dev pill and model pickers shown.');
    });
    DevSettings.addMenuItem?.('Toggle mock name and photo', () => {
      const { devMockIdentity, setDevMockIdentity } = useSettingsStore.getState();
      const next = !devMockIdentity;
      setDevMockIdentity(next);
      Alert.alert('Mock name and photo', next ? 'On: generic name and avatar shown.' : 'Off: your real profile shown.');
    });
  }, []);

  if (!__DEV__) return null;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Dev settings</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close dev settings" onPress={() => setOpen(false)} style={styles.close}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <DeveloperToolsSection embedded showScreenshotControls />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#1F1B16' },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  closeText: { fontSize: 15, fontWeight: '600', color: '#1F1B16' },
  content: { paddingBottom: 32 },
});
