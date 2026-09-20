import React, { useState, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import NotificationService, { type NotificationType } from '@/services/NotificationService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import {
  useDetectedPerformanceTier,
  usePerformanceTier,
  type PerformanceTierOverride,
} from '@/hooks/usePerformanceTier';
import { settingsColors as v2Colors, settingsTypography as v2Typography } from './settingsTheme';
import { SettingsRow } from './SettingsRow';
import { SettingsSectionBlock } from './SettingsSectionBlock';

interface DeveloperToolsSectionProps {
  resetSettings?: () => Promise<void> | void;
  onResetOnboarding?: () => Promise<void> | void;
}

const TIERS: ReadonlyArray<{
  value: 'pro' | 'trial' | 'expired' | 'free';
  label: string;
}> = [
  { value: 'pro', label: 'Pro' },
  { value: 'trial', label: 'Trial' },
  { value: 'expired', label: 'Expired' },
  { value: 'free', label: 'Free' },
];

const PERF_TIERS: ReadonlyArray<{ value: PerformanceTierOverride; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Med' },
  { value: 'low', label: 'Low' },
];

const TEST_NOTIFICATION_DELAY_SECONDS = 5;

const TEST_NOTIFICATION_OPTIONS: Array<{
  type: NotificationType;
  title: string;
  subtitle: string;
}> = [
  {
    type: 'daily_reminder',
    title: 'Daily Practice Reminder',
    subtitle: 'Return-to-anchor reminder payload',
  },
  {
    type: 'daily_goal_checkpoint',
    title: 'Goal Checkpoint',
    subtitle: 'Daily progress checkpoint payload',
  },
  {
    type: 'ritual_reminder',
    title: 'Ritual Reminder',
    subtitle: 'Anchor ritual reminder payload',
  },
  {
    type: 'streak_protection',
    title: 'Streak Protection',
    subtitle: 'Momentum protection payload',
  },
  {
    type: 'weekly_summary',
    title: 'Weekly Summary',
    subtitle: 'Weekly reflection payload',
  },
];

const PerfTierPicker: React.FC = () => {
  const { devPerfTierOverride, setDevPerfTierOverride } = useSettingsStore((s) => ({
    devPerfTierOverride: s.devPerfTierOverride,
    setDevPerfTierOverride: s.setDevPerfTierOverride,
  }));
  const detectedTier = useDetectedPerformanceTier();
  const autoTier = usePerformanceTier({ override: 'auto' });

  return (
    <View style={styles.segmentRow}>
      <View style={styles.perfTierHeader}>
        <Text style={styles.segmentTitle}>Performance Tier Override</Text>
        <Text style={styles.perfTierDetected}>
          Device: {detectedTier} · Auto: {autoTier}
        </Text>
      </View>
      <View style={styles.segmentedControl}>
        {PERF_TIERS.map(({ value, label }) => {
          const selected = devPerfTierOverride === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Set performance tier to ${label}`}
              onPress={() => setDevPerfTierOverride(value)}
              style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.perfTierHint}>
        Forces animation and glow tier. Device is raw hardware capability; Auto factors in battery saver and reduce-motion.
      </Text>
    </View>
  );
};

export const DeveloperToolsSection: React.FC<DeveloperToolsSectionProps> = ({
  resetSettings,
  onResetOnboarding,
}) => {
  // STRICT BUILD GATE: never render developer controls in production
  if (!__DEV__) {
    return null;
  }

  const [isExpanded, setIsExpanded] = useState(false);
  const [showOnboardingTools, setShowOnboardingTools] = useState(true);
  const [showSubscriptionTools, setShowSubscriptionTools] = useState(false);
  const [showAnchorTools, setShowAnchorTools] = useState(false);
  const [showRecommendationTools, setShowRecommendationTools] = useState(false);
  const [showNotificationTools, setShowNotificationTools] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(false);

  const [isNotificationActionRunning, setIsNotificationActionRunning] = useState(false);
  const [devStatusMessage, setDevStatusMessage] = useState<string | null>(null);

  // Store bindings
  const anchors = useAnchorStore((state) => state.anchors);
  const currentAnchorId = useAnchorStore((state) => state.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((state) => state.setCurrentAnchor);
  const updateAnchorState = useAnchorStore((state) => state.updateAnchor);

  const subStore = useSubscriptionStore();
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const setHasCompletedOnboarding = useAuthStore((state) => state.setHasCompletedOnboarding);

  const developerModeEnabled = useSettingsStore((s) => s.developerModeEnabled);
  const setDeveloperModeEnabled = useSettingsStore((s) => s.setDeveloperModeEnabled);
  const developerMasterAccountEnabled = useSettingsStore((s) => s.developerMasterAccountEnabled);
  const setDeveloperMasterAccountEnabled = useSettingsStore((s) => s.setDeveloperMasterAccountEnabled);
  const developerSkipOnboardingEnabled = useSettingsStore((s) => s.developerSkipOnboardingEnabled);
  const setDeveloperSkipOnboardingEnabled = useSettingsStore((s) => s.setDeveloperSkipOnboardingEnabled);
  const developerForceStreakBreakEnabled = useSettingsStore((s) => s.developerForceStreakBreakEnabled);
  const setDeveloperForceStreakBreakEnabled = useSettingsStore((s) => s.setDeveloperForceStreakBreakEnabled);
  const developerDeleteWithoutBurnEnabled = useSettingsStore((s) => s.developerDeleteWithoutBurnEnabled);
  const setDeveloperDeleteWithoutBurnEnabled = useSettingsStore((s) => s.setDeveloperDeleteWithoutBurnEnabled);
  const debugLoggingEnabled = useSettingsStore((s) => s.debugLoggingEnabled);
  const setDebugLoggingEnabled = useSettingsStore((s) => s.setDebugLoggingEnabled);
  const triggerDeveloperWeeklySummaryPreview = useSettingsStore(
    (state) => state.triggerDeveloperWeeklySummaryPreview
  );

  const activeAnchor = useMemo(() => {
    if (currentAnchorId) {
      const found = anchors.find((a) => a.id === currentAnchorId || a.localId === currentAnchorId);
      if (found) return found;
    }
    return anchors[0];
  }, [anchors, currentAnchorId]);

  const activeAnchorLabel = activeAnchor?.intentionText?.trim() || 'No active anchor';

  // 1. Onboarding Actions
  const handleSafeResetOnboarding = () => {
    Alert.alert(
      'Safe Reset Onboarding',
      'This will reset the onboarding completion flag and first-run draft so you can re-experience first-run. Your account and saved anchors remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Onboarding',
          style: 'destructive',
          onPress: async () => {
            try {
              try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const pathPart = ['v2', 'firstRunStore'].join('/');
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const firstRunModule = require(`@/stores/${pathPart}`);
                firstRunModule?.useFirstRunStore?.getState()?.reset();
              } catch {
                // Ignore if firstRunStore reset fails
              }
              setHasCompletedOnboarding(false);
              setDeveloperSkipOnboardingEnabled(false);
              if (onResetOnboarding) await onResetOnboarding();
              setDevStatusMessage('Onboarding reset. Relaunch or navigate to First Run.');
            } catch (error) {
              Alert.alert('Reset Failed', error instanceof Error ? error.message : 'Could not reset onboarding.');
            }
          },
        },
      ]
    );
  };

  const handleMarkOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    setDevStatusMessage('Marked onboarding as complete.');
  };

  // 2. Subscription Actions
  const selectedTier = subStore.devTierOverride;

  const handleClearSubscriptionOverrides = () => {
    subStore.resetOverrides();
    setDevStatusMessage('Subscription dev overrides cleared. Real RevenueCat authority restored.');
  };

  // 3. Anchor Actions
  const handleResetFirstPrimeState = () => {
    if (!activeAnchor) {
      Alert.alert('No Anchor Available', 'Create or select an anchor first.');
      return;
    }

    Alert.alert(
      'Reset First Prime State',
      `Reset "${activeAnchorLabel}" back to an unprimed state (chargeCount = 0)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await updateAnchorState(activeAnchor.id, {
              isCharged: false,
              chargedAt: undefined,
              firstChargedAt: undefined,
              chargeCount: 0,
            });
            setDevStatusMessage(`Reset "${activeAnchorLabel}" for first-prime retesting.`);
          },
        },
      ]
    );
  };

  // 4. Notifications Actions
  const handleScheduleNotificationTest = async (
    type: NotificationType,
    label: string
  ): Promise<void> => {
    setIsNotificationActionRunning(true);
    try {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        const message = NotificationService.getLastError()?.message ?? 'Notification permissions were denied.';
        setDevStatusMessage(message);
        Alert.alert('Permission Required', message);
        return;
      }

      const identifier = await NotificationService.scheduleDeveloperTestNotification(
        type,
        TEST_NOTIFICATION_DELAY_SECONDS
      );

      if (!identifier) {
        const message = NotificationService.getLastError()?.message ?? 'Failed to schedule test notification.';
        setDevStatusMessage(message);
        Alert.alert('Schedule Failed', message);
        return;
      }

      setDevStatusMessage(`${label} scheduled (+${TEST_NOTIFICATION_DELAY_SECONDS}s).`);
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  const handleInspectScheduledTests = async (): Promise<void> => {
    setIsNotificationActionRunning(true);
    try {
      const scheduled = await NotificationService.getDeveloperTestNotifications();
      const error = NotificationService.getLastError();
      if (error) {
        setDevStatusMessage(error.message);
        Alert.alert('Queue Error', error.message);
        return;
      }
      if (scheduled.length === 0) {
        const message = 'No developer notification tests are currently queued.';
        setDevStatusMessage(message);
        Alert.alert('Queue Empty', message);
        return;
      }
      const message = scheduled.map((n, i) => `${i + 1}. ${n.identifier}`).join('\n');
      setDevStatusMessage(`${scheduled.length} test notification(s) queued.`);
      Alert.alert('Scheduled Tests', message);
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  const handleClearScheduledTests = async (): Promise<void> => {
    setIsNotificationActionRunning(true);
    try {
      const count = await NotificationService.cancelDeveloperTestNotifications();
      setDevStatusMessage(count === 0 ? 'No tests were queued.' : `Cleared ${count} scheduled test(s).`);
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  // 5. Destructive Master Reset
  const handleMasterReset = () => {
    Alert.alert(
      'Reset All Developer Overrides',
      'This will reset all developer flags, tier overrides, performance settings, and streak breaks back to their default values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: async () => {
            subStore.resetOverrides();
            setDeveloperModeEnabled(false);
            setDeveloperMasterAccountEnabled(false);
            setDeveloperSkipOnboardingEnabled(false);
            setDeveloperForceStreakBreakEnabled(false);
            setDeveloperDeleteWithoutBurnEnabled(false);
            setDebugLoggingEnabled(false);
            useSettingsStore.getState().setDevPerfTierOverride('auto');
            if (resetSettings) await resetSettings();
            setDevStatusMessage('All developer flags reset to defaults.');
          },
        },
      ]
    );
  };

  const renderAccordionHeader = (
    title: string,
    description: string,
    expanded: boolean,
    onPress: () => void
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} section, ${expanded ? 'expanded' : 'collapsed'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.accordionHeader, pressed && styles.accordionHeaderPressed]}
    >
      <View style={styles.accordionHeaderCopy}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Text style={styles.accordionDescription}>{description}</Text>
      </View>
      <Text style={[styles.accordionChevron, expanded && styles.accordionChevronExpanded]}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrapper}>
      {/* Developer Tools Main Banner */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Developer Tools, ${isExpanded ? 'collapse' : 'expand'}`}
        onPress={() => setIsExpanded((current) => !current)}
        style={({ pressed }) => [styles.devToolsHeader, pressed && styles.devToolsHeaderPressed]}
      >
        <View style={styles.devToolsHeaderContent}>
          <View style={styles.devToolsTitleRow}>
            <Text style={styles.label}>⌥ Developer Tools</Text>
            <View style={styles.buildBadge}>
              <Text style={styles.buildBadgeText}>DEV ONLY</Text>
            </View>
          </View>
          <Text style={styles.description}>Internal testing controls · Stripped in release builds</Text>
        </View>
        <Text style={[styles.devToolsChevron, isExpanded && styles.devToolsChevronExpanded]}>›</Text>
      </Pressable>

      {!isExpanded ? null : (
        <View style={styles.contentContainer}>
          {/* Section A: Onboarding & First-Run */}
          <SettingsSectionBlock isDev>
            {renderAccordionHeader(
              'Onboarding & First-Run',
              `Current: ${hasCompletedOnboarding ? 'Completed' : 'Pending'}`,
              showOnboardingTools,
              () => setShowOnboardingTools((c) => !c)
            )}
            {showOnboardingTools ? (
              <>
                <SettingsRow
                  title="Safe Reset Onboarding"
                  subtitle="Reset first-run state without clearing account"
                  type="none"
                  onPress={handleSafeResetOnboarding}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Reset</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Mark Onboarding Complete"
                  subtitle="Instantly grant completed status"
                  type="none"
                  onPress={handleMarkOnboardingComplete}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Complete</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Sign In (Dev Master Account)"
                  subtitle="Instantly sign in with test credentials"
                  type="none"
                  onPress={() => {
                    useAuthStore.getState().enableDeveloperMasterAccount();
                    setDevStatusMessage('Signed in with Developer Master Account.');
                  }}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Sign In</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Skip Onboarding Gate"
                  subtitle="Bypass root onboarding check"
                  type="toggle"
                  toggleValue={developerSkipOnboardingEnabled}
                  onToggle={setDeveloperSkipOnboardingEnabled}
                  isDev
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Section B: Subscription & Paywall Testing */}
          <SettingsSectionBlock isDev style={styles.subBlock}>
            {renderAccordionHeader(
              'Subscription & Paywall',
              subStore.devOverrideEnabled ? `Simulating: ${selectedTier.toUpperCase()}` : 'Real RevenueCat authority',
              showSubscriptionTools,
              () => setShowSubscriptionTools((c) => !c)
            )}
            {showSubscriptionTools ? (
              <>
                <SettingsRow
                  title="Enable Dev Overrides"
                  subtitle="Bypass RevenueCat network authority"
                  type="toggle"
                  toggleValue={subStore.devOverrideEnabled}
                  onToggle={subStore.setDevOverrideEnabled}
                  isDev
                />
                <View style={styles.segmentRow}>
                  <Text style={styles.segmentTitle}>Simulated Subscription Tier</Text>
                  <View style={styles.segmentedControl}>
                    {TIERS.map(({ value, label }) => {
                      const selected = selectedTier === value;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityLabel={`Select simulated tier ${label}`}
                          onPress={() => subStore.setDevTierOverride(value)}
                          style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
                        >
                          <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.segmentHint}>
                    Overrides useTrialStatus() directly. Pro/Trial enable premium gates; Expired/Free test paywall triggers.
                  </Text>
                </View>
                <SettingsRow
                  title="Clear Subscription Overrides"
                  subtitle="Restore live RevenueCat state"
                  type="none"
                  onPress={handleClearSubscriptionOverrides}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Restore</Text>
                    </View>
                  }
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Section C: Anchor & State Testing */}
          <SettingsSectionBlock isDev style={styles.subBlock}>
            {renderAccordionHeader(
              'Anchor & Practice State',
              `Active: ${activeAnchorLabel.slice(0, 24)}${activeAnchorLabel.length > 24 ? '…' : ''}`,
              showAnchorTools,
              () => setShowAnchorTools((c) => !c)
            )}
            {showAnchorTools ? (
              <>
                <View style={styles.anchorSwitcher}>
                  <Text style={styles.segmentTitle}>Active Anchor ({anchors.length} Total)</Text>
                  {anchors.length === 0 ? (
                    <Text style={styles.emptyText}>No anchors found on this account.</Text>
                  ) : (
                    anchors.slice(0, 6).map((anchor) => {
                      const isCurrent = anchor.id === (activeAnchor?.id);
                      return (
                        <Pressable
                          key={anchor.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Switch to anchor ${anchor.intentionText}`}
                          onPress={() => {
                            setCurrentAnchor(anchor.id);
                            setDevStatusMessage(`Active anchor set to "${anchor.intentionText?.slice(0, 20)}…"`);
                          }}
                          style={[styles.anchorRow, isCurrent && styles.anchorRowActive]}
                        >
                          <Text style={[styles.anchorRowText, isCurrent && styles.anchorRowTextActive]} numberOfLines={1}>
                            {anchor.intentionText || 'Untitled'}
                          </Text>
                          {isCurrent ? (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>ACTIVE</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>
                <SettingsRow
                  title="Reset First Prime State"
                  subtitle={`Reset charged state on "${activeAnchorLabel.slice(0, 20)}…"`}
                  type="none"
                  onPress={handleResetFirstPrimeState}
                  disabled={!activeAnchor}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Reset</Text>
                    </View>
                  }
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Section D: Recommendation Outcomes */}
          <SettingsSectionBlock isDev style={styles.subBlock}>
            {renderAccordionHeader(
              'Recommendation Engine (V2)',
              'Test triggers for all 4 daily recommendation outcomes',
              showRecommendationTools,
              () => setShowRecommendationTools((c) => !c)
            )}
            {showRecommendationTools ? (
              <View style={styles.outcomeContainer}>
                <Text style={styles.outcomeDescription}>
                  Anchor 2.0 evaluates daily recommendations authoritatively. Use these conditions to exercise each outcome:
                </Text>
                <View style={styles.outcomeCard}>
                  <Text style={styles.outcomeTitle}>1. Release</Text>
                  <Text style={styles.outcomeDetail}>
                    Triggered when anchor has reached its destination or all course waypoints are completed.
                  </Text>
                </View>
                <View style={styles.outcomeCard}>
                  <Text style={styles.outcomeTitle}>2. Visualize</Text>
                  <Text style={styles.outcomeDetail}>
                    Triggered when an active Vision exists and has not been opened today.
                  </Text>
                </View>
                <View style={styles.outcomeCard}>
                  <Text style={styles.outcomeTitle}>3. Deep Prime</Text>
                  <Text style={styles.outcomeDetail}>
                    Triggered when thread strength is softening (7-day decay delta is negative).
                  </Text>
                </View>
                <View style={styles.outcomeCard}>
                  <Text style={styles.outcomeTitle}>4. Focus</Text>
                  <Text style={styles.outcomeDetail}>
                    Standard daily reinforcement when thread is healthy and no release/visualize signals are pending.
                  </Text>
                </View>
              </View>
            ) : null}
          </SettingsSectionBlock>

          {/* Section E: Notification Tester */}
          <SettingsSectionBlock isDev style={styles.subBlock}>
            {renderAccordionHeader(
              'Notification Tester',
              `Schedule test payloads with +${TEST_NOTIFICATION_DELAY_SECONDS}s delay`,
              showNotificationTools,
              () => setShowNotificationTools((c) => !c)
            )}
            {showNotificationTools ? (
              <>
                {TEST_NOTIFICATION_OPTIONS.map((option) => (
                  <SettingsRow
                    key={option.type}
                    title={option.title}
                    subtitle={option.subtitle}
                    type="none"
                    onPress={() => void handleScheduleNotificationTest(option.type, option.title)}
                    disabled={isNotificationActionRunning}
                    isDev
                    rightElement={
                      <View style={styles.actionBadge}>
                        <Text style={styles.actionBadgeText}>+{TEST_NOTIFICATION_DELAY_SECONDS}s</Text>
                      </View>
                    }
                  />
                ))}
                <SettingsRow
                  title="Inspect Queued Tests"
                  subtitle="List scheduled developer test notifications"
                  type="none"
                  onPress={() => void handleInspectScheduledTests()}
                  disabled={isNotificationActionRunning}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Queue</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Clear Queued Tests"
                  subtitle="Cancel all scheduled developer notifications"
                  type="none"
                  onPress={() => void handleClearScheduledTests()}
                  disabled={isNotificationActionRunning}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Clear</Text>
                    </View>
                  }
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Section F: Performance & Debug Logging */}
          <SettingsSectionBlock isDev style={styles.subBlock}>
            {renderAccordionHeader(
              'Performance & Debug Flags',
              'Glow tiers, verbose logging, and streak testing',
              showDebugTools,
              () => setShowDebugTools((c) => !c)
            )}
            {showDebugTools ? (
              <>
                <PerfTierPicker />
                <SettingsRow
                  title="Debug Console Logging"
                  subtitle="Verbose telemetry & network logs"
                  type="toggle"
                  toggleValue={debugLoggingEnabled}
                  onToggle={setDebugLoggingEnabled}
                  isDev
                />
                <SettingsRow
                  title="Force Streak Break"
                  subtitle="Simulate missed practice days"
                  type="toggle"
                  toggleValue={developerForceStreakBreakEnabled}
                  onToggle={setDeveloperForceStreakBreakEnabled}
                  isDev
                />
                <SettingsRow
                  title="Direct Anchor Deletion"
                  subtitle="Delete without requiring burn ritual"
                  type="toggle"
                  toggleValue={developerDeleteWithoutBurnEnabled}
                  onToggle={setDeveloperDeleteWithoutBurnEnabled}
                  isDev
                />
                <SettingsRow
                  title="Weekly Summary Preview"
                  subtitle="Force summary sheet on next visit"
                  type="none"
                  onPress={() => {
                    triggerDeveloperWeeklySummaryPreview();
                    setDevStatusMessage('Weekly summary modal primed.');
                  }}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Prime</Text>
                    </View>
                  }
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Developer Status Feedback Banner */}
          {devStatusMessage ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusBoxLabel}>DEVELOPER STATUS</Text>
              <Text style={styles.statusBoxText}>{devStatusMessage}</Text>
            </View>
          ) : null}

          {/* Master Reset Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset all developer overrides"
            onPress={handleMasterReset}
            style={({ pressed }) => [styles.masterResetButton, pressed && styles.masterResetButtonPressed]}
          >
            <View>
              <Text style={styles.masterResetTitle}>Reset All Developer Overrides</Text>
              <Text style={styles.masterResetSubtext}>Restores all developer flags to defaults</Text>
            </View>
            <Text style={styles.masterResetChevron}>›</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
  },
  devToolsHeader: {
    marginHorizontal: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.25)',
    backgroundColor: 'rgba(4, 120, 87, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devToolsHeaderPressed: {
    backgroundColor: 'rgba(4, 120, 87, 0.09)',
  },
  devToolsHeaderContent: {
    flex: 1,
    marginRight: 8,
  },
  devToolsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#047857',
    fontSize: 13,
    fontFamily: v2Typography.bodySemiBold,
    letterSpacing: 0.3,
  },
  buildBadge: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.3)',
    backgroundColor: 'rgba(4, 120, 87, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  buildBadgeText: {
    color: '#047857',
    fontSize: 9.5,
    fontFamily: v2Typography.bodyBold,
    letterSpacing: 0.6,
  },
  description: {
    marginTop: 4,
    color: 'rgba(4, 120, 87, 0.75)',
    fontSize: 12,
    fontFamily: v2Typography.body,
    lineHeight: 16,
  },
  devToolsChevron: {
    color: '#047857',
    fontSize: 18,
    lineHeight: 18,
    transform: [{ rotate: '0deg' }],
  },
  devToolsChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  contentContainer: {
    marginTop: 10,
    gap: 8,
  },
  subBlock: {
    marginTop: 2,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(4, 120, 87, 0.18)',
  },
  accordionHeaderPressed: {
    backgroundColor: 'rgba(4, 120, 87, 0.04)',
  },
  accordionHeaderCopy: {
    flex: 1,
    marginRight: 10,
  },
  accordionTitle: {
    color: '#047857',
    fontSize: 14.5,
    fontFamily: v2Typography.bodySemiBold,
  },
  accordionDescription: {
    marginTop: 2,
    color: 'rgba(4, 120, 87, 0.7)',
    fontSize: 12,
    fontFamily: v2Typography.body,
  },
  accordionChevron: {
    color: '#047857',
    fontSize: 16,
    transform: [{ rotate: '0deg' }],
  },
  accordionChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  segmentRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(4, 120, 87, 0.18)',
  },
  segmentTitle: {
    marginBottom: 8,
    color: '#047857',
    fontSize: 13,
    fontFamily: v2Typography.bodyMedium,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.25)',
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 120, 87, 0.04)',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(4, 120, 87, 0.2)',
  },
  segmentButtonSelected: {
    backgroundColor: 'rgba(4, 120, 87, 0.18)',
  },
  segmentText: {
    color: '#047857',
    fontSize: 12,
    fontFamily: v2Typography.body,
    opacity: 0.65,
  },
  segmentTextSelected: {
    opacity: 1,
    fontFamily: v2Typography.bodySemiBold,
  },
  segmentHint: {
    marginTop: 6,
    color: 'rgba(4, 120, 87, 0.6)',
    fontSize: 11,
    fontFamily: v2Typography.body,
    lineHeight: 15,
  },
  perfTierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  perfTierDetected: {
    color: 'rgba(4, 120, 87, 0.6)',
    fontSize: 10.5,
    fontFamily: v2Typography.body,
    textTransform: 'uppercase',
  },
  perfTierHint: {
    marginTop: 6,
    color: 'rgba(4, 120, 87, 0.6)',
    fontSize: 11,
    fontFamily: v2Typography.body,
    lineHeight: 15,
  },
  actionBadge: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.3)',
    backgroundColor: 'rgba(4, 120, 87, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontFamily: v2Typography.bodySemiBold,
  },
  anchorSwitcher: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(4, 120, 87, 0.18)',
  },
  emptyText: {
    color: 'rgba(4, 120, 87, 0.6)',
    fontSize: 12,
    fontFamily: v2Typography.body,
    fontStyle: 'italic',
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: 'rgba(4, 120, 87, 0.03)',
  },
  anchorRowActive: {
    backgroundColor: 'rgba(4, 120, 87, 0.12)',
  },
  anchorRowText: {
    color: v2Colors.text.primary,
    fontSize: 13,
    fontFamily: v2Typography.body,
    flex: 1,
  },
  anchorRowTextActive: {
    color: '#047857',
    fontFamily: v2Typography.bodySemiBold,
  },
  activePill: {
    borderRadius: 4,
    backgroundColor: '#047857',
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 8,
  },
  activePillText: {
    color: '#FBF9F4',
    fontSize: 9,
    fontFamily: v2Typography.bodyBold,
  },
  outcomeContainer: {
    padding: 16,
    gap: 8,
  },
  outcomeDescription: {
    color: 'rgba(4, 120, 87, 0.8)',
    fontSize: 12,
    fontFamily: v2Typography.body,
    lineHeight: 16,
    marginBottom: 4,
  },
  outcomeCard: {
    borderRadius: 8,
    backgroundColor: 'rgba(4, 120, 87, 0.05)',
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(4, 120, 87, 0.15)',
  },
  outcomeTitle: {
    color: '#047857',
    fontSize: 12.5,
    fontFamily: v2Typography.bodySemiBold,
    marginBottom: 2,
  },
  outcomeDetail: {
    color: v2Colors.text.secondary,
    fontSize: 11.5,
    fontFamily: v2Typography.body,
    lineHeight: 15,
  },
  statusBox: {
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(4, 120, 87, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.25)',
    padding: 12,
  },
  statusBoxLabel: {
    color: '#047857',
    fontSize: 9.5,
    fontFamily: v2Typography.bodyBold,
    letterSpacing: 0.6,
  },
  statusBoxText: {
    marginTop: 3,
    color: '#047857',
    fontSize: 12,
    fontFamily: v2Typography.body,
  },
  masterResetButton: {
    marginHorizontal: 0,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(182, 59, 56, 0.3)',
    backgroundColor: 'rgba(182, 59, 56, 0.04)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterResetButtonPressed: {
    backgroundColor: 'rgba(182, 59, 56, 0.08)',
  },
  masterResetTitle: {
    color: '#B63B38',
    fontSize: 13,
    fontFamily: v2Typography.bodySemiBold,
  },
  masterResetSubtext: {
    marginTop: 2,
    color: 'rgba(182, 59, 56, 0.7)',
    fontSize: 11,
    fontFamily: v2Typography.body,
  },
  masterResetChevron: {
    color: '#B63B38',
    fontSize: 16,
  },
});
