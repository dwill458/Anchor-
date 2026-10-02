import React, { useState } from 'react';
import {
  DeviceEventEmitter,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { seedV2DemoAnchor, DEMO_ANCHOR_ID } from '@/utils/v2DevSeeder';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radii, spacing, typography } from '@/theme/v2';

export function V2DevFloatingToolbar() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const activeAnchor = useAnchorStore((s) => s.anchors[0]);

  if (!__DEV__) return null;

  const handleSeed = () => {
    seedV2DemoAnchor();
    setOpen(false);
  };

  const handleOpenCreation = () => {
    setOpen(false);
    navigation.navigate('FirstAnchorCreation');
  };

  const handleOpenStateMachineCreation = () => {
    setOpen(false);
    navigation.navigate('V2Creation');
  };

  const handleOpenVision = () => {
    setOpen(false);
    const id = activeAnchor?.id ?? DEMO_ANCHOR_ID;
    navigation.navigate('V2Vision', { anchorId: id });
  };

  const handleOpenChart = () => {
    setOpen(false);
    const id = activeAnchor?.id ?? DEMO_ANCHOR_ID;
    navigation.navigate('V2Chart', { anchorId: id });
  };

  const handleVisionQA = () => {
    setOpen(false);
    DeviceEventEmitter.emit('openVisionVisualQA', { surface: '2' });
  };

  const handleCreationQA = () => {
    setOpen(false);
    DeviceEventEmitter.emit('openCreationFlowQA', { start: 'intention' });
  };

  const handleChartLab = () => {
    setOpen(false);
    DeviceEventEmitter.emit('openChartLab');
  };

  const handleResetOnboarding = () => {
    useAuthStore.getState().setHasCompletedOnboarding(false);
    useSettingsStore.getState().setDeveloperSkipOnboardingEnabled(false);
    setOpen(false);
    navigation.reset({ index: 0, routes: [{ name: 'V2FirstRun' }] });
  };

  return (
    <>
      <Pressable
        testID="v2-dev-pill"
        accessibilityRole="button"
        accessibilityLabel="Developer QA Toolbar"
        onPress={() => setOpen(true)}
        style={[styles.floatingBadge, { bottom: Math.max(insets.bottom, 16) + 12 }]}
      >
        <Text style={styles.badgeText}>🛠️ DEV</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Anchor 2.0 Dev Tools</Text>
            <Text style={styles.subtitle}>
              Active anchor: {activeAnchor ? activeAnchor.intentionText.slice(0, 30) + '…' : 'None (Empty)'}
            </Text>

            <ScrollView style={styles.actionList} showsVerticalScrollIndicator={false}>
              <Pressable style={styles.actionRowPrimary} onPress={handleSeed}>
                <Text style={styles.actionRowPrimaryText}>⚡ Seed Demo Anchor + Vision + Chart</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleOpenCreation}>
                <Text style={styles.actionRowText}>✨ Tactile Creation Flow (Hold to Seal)</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleOpenStateMachineCreation}>
                <Text style={styles.actionRowText}>⚙️ V2 State-Machine Creation Flow</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleOpenVision}>
                <Text style={styles.actionRowText}>🖼️ V2 Vision Screen / Board</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleOpenChart}>
                <Text style={styles.actionRowText}>🗺️ V2 Chart Screen</Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable style={styles.actionRow} onPress={handleVisionQA}>
                <Text style={styles.actionRowText}>🔬 Vision Visual QA Lab</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleCreationQA}>
                <Text style={styles.actionRowText}>🧪 Creation Flow QA Lab (Intention → Seal)</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleChartLab}>
                <Text style={styles.actionRowText}>📊 Chart Motion Lab</Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable style={styles.actionRowDanger} onPress={handleResetOnboarding}>
                <Text style={styles.actionRowDangerText}>↺ Reset & Return to First Run (Onboarding)</Text>
              </Pressable>
            </ScrollView>

            <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(20, 22, 43, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 9999,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  badgeText: {
    color: '#F4EDE0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: '#FAF7F2',
    borderRadius: radii.lg,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    ...typography.headingSM,
    color: colors.ink.base,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodySM,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  actionList: {
    maxHeight: 380,
  },
  actionRowPrimary: {
    backgroundColor: colors.ink.base,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    marginBottom: 8,
  },
  actionRowPrimaryText: {
    color: '#FAF7F2',
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    backgroundColor: '#EDE8DF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    marginBottom: 8,
  },
  actionRowText: {
    color: colors.ink.base,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#DDD6C9',
    marginVertical: 8,
  },
  actionRowDanger: {
    backgroundColor: 'rgba(180, 40, 40, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    marginBottom: 8,
  },
  actionRowDangerText: {
    color: '#A02020',
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeButtonText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
