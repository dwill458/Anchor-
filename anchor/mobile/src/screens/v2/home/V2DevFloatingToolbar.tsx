import React, { useState } from 'react';
import { devMenuStyles } from '@/components/dev/devMenuStyles';
import Slider from '@react-native-community/slider';
import { DeveloperToolsSection } from '@/components/settings/DeveloperToolsSection';
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
import { useDevThreadStrengthStore } from '@/stores/devThreadStrengthStore';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { DEV_MILESTONE_LABELS, makeDevMilestoneRecord } from '@/milestones/devTrigger';
import { resetChartIntroSeen } from '@/components/v2/chart/chartIntroSeen';
import {
  useDetectedPerformanceTier,
  usePerformanceTier,
  type PerformanceTierOverride,
} from '@/hooks/usePerformanceTier';
import { colors, radii, typography } from '@/theme/v2';

export function V2DevFloatingToolbar() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'preview' | 'settings'>('preview');
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const activeAnchor = useAnchorStore((s) => s.anchors.find((a) => a.id === s.currentAnchorId || a.localId === s.currentAnchorId) ?? s.anchors[0]);
  const simulatedStrength = useDevThreadStrengthStore((s) => s.value);
  const simulateStrength = useDevThreadStrengthStore((s) => s.simulate);

  const devPerfTierOverride: PerformanceTierOverride = (
    typeof useSettingsStore === 'function'
      ? useSettingsStore((s: any) => s?.devPerfTierOverride)
      : (useSettingsStore as any)?.getState?.()?.devPerfTierOverride
  ) ?? 'auto';

  const setDevPerfTierOverride = (tier: PerformanceTierOverride) => {
    if (typeof useSettingsStore === 'function') {
      useSettingsStore.getState?.()?.setDevPerfTierOverride?.(tier);
    } else {
      (useSettingsStore as any)?.getState?.()?.setDevPerfTierOverride?.(tier);
    }
  };

  const detectedTier = useDetectedPerformanceTier();
  const effectiveTier = usePerformanceTier({ override: devPerfTierOverride });
  const devControlsHidden = (
    typeof useSettingsStore === 'function'
      ? useSettingsStore((s: any) => s?.devHideDevControls)
      : (useSettingsStore as any)?.getState?.()?.devHideDevControls
  ) ?? false;

  if (!__DEV__ || devControlsHidden) return null;

  // Plays a milestone celebration without earning anything: it is a non-awarding replay of a
  // synthetic record, queued after this dialog has closed (two modals cannot present together).
  const handleTriggerMilestone = (definitionId: string) => {
    const record = makeDevMilestoneRecord(definitionId, activeAnchor?.id ?? 'dev-anchor');
    if (!record) return;
    setOpen(false);
    setTimeout(() => useMilestoneCelebrationStore.getState().requestReplay(record), 400);
  };

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

  // Dev only: the one-shot replay mode rides on the route and the Chart screen clears it once the opening starts.
  const handleReplayChartOpening = (mode: 'full' | 'short') => {
    setOpen(false);
    const id = activeAnchor?.id ?? DEMO_ANCHOR_ID;
    void resetChartIntroSeen()
      .catch(() => undefined)
      .then(() => navigation.navigate('V2Chart', { anchorId: id, introReplayMode: mode }));
  };

  // Dev only: opens the 2.0 weekly recap from anywhere in the V2 stack. Waits for this dialog to close first.
  const handleOpenWeeklySummaryPreview = () => {
    setOpen(false);
    setTimeout(() => navigation.navigate('V2WeeklyInsight', { forceRecapV2: true }), 400);
  };

  const handleResetChartIntro = () => {
    setOpen(false);
    void resetChartIntroSeen().catch(() => undefined);
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
        <View style={styles.scrim}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close Developer Tools"
            onPress={() => setOpen(false)}
          />
          <View style={styles.dialog}>
            <Text style={styles.title}>Anchor 2.0 Dev Tools</Text>
            <Text style={styles.subtitle}>
              Active anchor: {activeAnchor ? activeAnchor.intentionText.slice(0, 30) + '…' : 'None (Empty)'}
            </Text>

            <View style={styles.chipRow} accessibilityRole="tablist">
              {(['preview', 'settings'] as const).map((item) => (
                <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }}
                  onPress={() => setTab(item)} style={[styles.chip, tab === item && styles.chipActive]}>
                  <Text style={[styles.chipText, tab === item && styles.chipTextActive]}>{item === 'preview' ? 'Preview & QA' : 'Dev Settings'}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView
              key={tab}
              style={styles.actionList}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {tab === 'settings' ? (
                <DeveloperToolsSection
                  embedded
                  onResetOnboarding={handleResetOnboarding}
                  onWeeklySummaryPrimed={handleOpenWeeklySummaryPreview}
                />
              ) : <>
              <Text style={styles.sectionLabel}>
                Thread Strength: {simulatedStrength ?? activeAnchor?.threadStrength ?? '—'}%{simulatedStrength === null ? ' · Real' : ' · Mock'}
              </Text>
              <Text style={styles.subtitle}>Local preview of percentage and glow. Nothing is saved or uploaded.</Text>
              <View style={styles.sliderRow}>
                <Slider
                  testID="v2-dev-strength-slider"
                  accessibilityLabel="Mock Thread Strength percentage"
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={simulatedStrength ?? activeAnchor?.threadStrength ?? 0}
                  onValueChange={simulateStrength}
                  minimumTrackTintColor={colors.ink.base}
                  thumbTintColor={colors.ink.base}
                  style={styles.slider}
                />
                <Pressable
                  testID="v2-dev-strength-real"
                  accessibilityRole="button"
                  accessibilityLabel="Restore real Thread Strength percentage"
                  accessibilityState={{ selected: simulatedStrength === null }}
                  style={[styles.chip, styles.realButton, simulatedStrength === null && styles.chipActive]}
                  onPress={() => simulateStrength(null)}
                >
                  <Text style={[styles.chipText, simulatedStrength === null && styles.chipTextActive]}>Real %</Text>
                </Pressable>
              </View>
              <View style={styles.sliderLabels}><Text style={styles.sectionLabel}>0%</Text><Text style={styles.sectionLabel}>100%</Text></View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Creation & screens</Text>
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

              <Text style={styles.sectionLabel}>Labs & Chart opening</Text>
              <Pressable style={styles.actionRow} onPress={handleVisionQA}>
                <Text style={styles.actionRowText}>🔬 Vision Visual QA Lab</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleCreationQA}>
                <Text style={styles.actionRowText}>🧪 Creation Flow QA Lab (Intention → Seal)</Text>
              </Pressable>

              <Pressable style={styles.actionRow} onPress={handleChartLab}>
                <Text style={styles.actionRowText}>📊 Chart Motion Lab</Text>
              </Pressable>

              {__DEV__ ? (
                <>
                  <Pressable style={styles.actionRow} onPress={() => handleReplayChartOpening('full')}>
                    <Text style={styles.actionRowText}>Replay opening (full)</Text>
                  </Pressable>

                  <Pressable style={styles.actionRow} onPress={() => handleReplayChartOpening('short')}>
                    <Text style={styles.actionRowText}>Replay opening (short)</Text>
                  </Pressable>

                  <Pressable style={styles.actionRow} onPress={handleResetChartIntro}>
                    <Text style={styles.actionRowText}>Reset intro seen</Text>
                  </Pressable>
                </>
              ) : null}

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>
                Visual Tier: {effectiveTier.toUpperCase()}
                {devPerfTierOverride === 'auto' ? ` (Auto: ${detectedTier})` : ' (Forced)'}
              </Text>
              <View style={styles.chipRow}>
                {(['auto', 'high', 'medium', 'low'] as const).map((tier) => {
                  const isSelected = devPerfTierOverride === tier;
                  const label =
                    tier === 'auto' ? 'Auto' : tier === 'medium' ? 'Med' : tier.charAt(0).toUpperCase() + tier.slice(1);
                  return (
                    <Pressable
                      key={tier}
                      testID={`v2-dev-perf-${tier}`}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => setDevPerfTierOverride(tier)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Milestone celebration (plays only, saves nothing)</Text>
              <View style={styles.chipRow}>
                {DEV_MILESTONE_LABELS.map(({ id, label }) => (
                  <Pressable
                    key={id}
                    testID={`v2-dev-milestone-${id}`}
                    style={styles.chip}
                    onPress={() => handleTriggerMilestone(id)}
                  >
                    <Text style={styles.chipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.divider} />

              <Pressable style={styles.actionRowDanger} onPress={handleResetOnboarding}>
                <Text style={styles.actionRowDangerText}>↺ Reset & Return to First Run (Onboarding)</Text>
              </Pressable>
              </>}
            </ScrollView>

            <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  ...devMenuStyles,
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
    flexShrink: 1,
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
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1, height: 44 },
  realButton: { minHeight: 44, justifyContent: 'center' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginRight: 80 },
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
