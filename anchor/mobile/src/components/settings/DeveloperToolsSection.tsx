import React, { useState, useMemo } from 'react';
import { Alert, DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import NotificationService, { type NotificationType } from '@/services/NotificationService';
import { resetFirstRunStore } from '@/services/devOnboardingService';
import { seedV2DemoAnchor } from '@/utils/v2DevSeeder';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDevThreadStrengthStore } from '@/stores/devThreadStrengthStore';
import { useDevRecommendationOverride } from '@/stores/devRecommendationOverrideStore';
import type { V2RecommendationAction } from '@/constants/v2/practice';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import {
  useDetectedPerformanceTier,
  usePerformanceTier,
  type PerformanceTierOverride,
} from '@/hooks/usePerformanceTier';
import { DevMenuRow as SettingsRow } from '@/components/dev/DevMenuRow';
import { devMenuStyles } from '@/components/dev/devMenuStyles';
import { colors, radii } from '@/theme/v2';
import { SettingsSectionBlock } from './SettingsSectionBlock';
import {
  type DevOrientationMode,
  getDevOrientationMode,
  setDevOrientation,
  subscribeDevOrientation,
} from '@/utils/devOrientation';

const OUTCOME_CARDS: { action: V2RecommendationAction; title: string; detail: string }[] = [
  {
    action: 'Release',
    title: '1. Release',
    detail: 'Triggered when anchor has reached its destination or all course waypoints are completed.',
  },
  {
    action: 'Visualize',
    title: '2. Visualize',
    detail: 'Triggered when an active Vision exists and has not been opened today.',
  },
  {
    action: 'Deep Prime',
    title: '3. Deep Prime',
    detail: 'Triggered when thread strength is softening (7-day decay delta is negative).',
  },
  {
    action: 'Focus',
    title: '4. Focus',
    detail: 'Standard daily reinforcement when thread is healthy and no release/visualize signals are pending.',
  },
];

interface DeveloperToolsSectionProps {
  embedded?: boolean;
  resetSettings?: () => Promise<void> | void;
  onResetOnboarding?: () => Promise<void> | void;
  /** Called after the weekly summary preview is primed, so a host dialog can close first. */
  onWeeklySummaryPrimed?: () => void;
  /** Shows the screenshot toggles (hide dev controls, mock name and photo). Only the shake-opened sheet sets this. */
  showScreenshotControls?: boolean;
}

const DEV_ORIENTATION_OPTIONS: ReadonlyArray<{ value: DevOrientationMode; label: string }> = [
  { value: 'sensor', label: 'Auto (Sensor)' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

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
  embedded = false,
  onWeeklySummaryPrimed,
  showScreenshotControls = false,
}) => {
  // STRICT BUILD GATE: never render developer controls in production
  if (!__DEV__) {
    return null;
  }

  // Null outside a navigator (the shake-opened sheet), so the navigate action is guarded below.
  const navigation = React.useContext(NavigationContext) as any;
  const [isExpanded, setIsExpanded] = useState(embedded);
  const [showV2Tools, setShowV2Tools] = useState(true);
  const [showOnboardingTools, setShowOnboardingTools] = useState(false);
  const [showSubscriptionTools, setShowSubscriptionTools] = useState(false);
  const [showAnchorTools, setShowAnchorTools] = useState(false);
  const [showRecommendationTools, setShowRecommendationTools] = useState(false);
  const [showNotificationTools, setShowNotificationTools] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [showOrientationTools, setShowOrientationTools] = useState(false);
  const [devOrientation, setDevOrientationState] = useState<DevOrientationMode>(getDevOrientationMode);

  React.useEffect(() => {
    return subscribeDevOrientation(setDevOrientationState);
  }, []);

  const handleOrientationChange = async (mode: DevOrientationMode) => {
    setDevOrientationState(mode);
    const result = await setDevOrientation(mode);
    if (result.ok) {
      const label = mode === 'sensor' ? 'Auto-rotate (Sensor)' : mode === 'landscape' ? 'Landscape (Locked)' : 'Portrait (Locked)';
      setDevStatusMessage(`Screen orientation set to ${label}.`);
    } else {
      setDevStatusMessage(result.message ?? 'Failed to change orientation.');
    }
  };

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
  const devHideDevControls = useSettingsStore((s) => s.devHideDevControls);
  const setDevHideDevControls = useSettingsStore((s) => s.setDevHideDevControls);
  const devMockIdentity = useSettingsStore((s) => s.devMockIdentity);
  const setDevMockIdentity = useSettingsStore((s) => s.setDevMockIdentity);
  const devRecommendationAction = useDevRecommendationOverride((s) => s.action);
  const setDevRecommendationAction = useDevRecommendationOverride((s) => s.setAction);

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
              await resetFirstRunStore();
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
            useDevThreadStrengthStore.getState().simulate(null);
            setDeveloperModeEnabled(false);
            setDeveloperMasterAccountEnabled(false);
            setDeveloperSkipOnboardingEnabled(false);
            setDeveloperForceStreakBreakEnabled(false);
            setDeveloperDeleteWithoutBurnEnabled(false);
            setDebugLoggingEnabled(false);
            useSettingsStore.getState().setDevPerfTierOverride('auto');
            void setDevOrientation('sensor');
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
      accessibilityState={{ expanded }}
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
      {embedded ? null : <Pressable
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
      </Pressable>}

      {!isExpanded ? null : (
        <View style={styles.contentContainer}>
          {showScreenshotControls ? (
          <>
          {/* Screenshot mode: hides the floating dev pill and dev model pickers. */}
          <SettingsSectionBlock flat style={styles.subBlock}>
            <SettingsRow
              title="Hide dev controls"
              subtitle="Hides the DEV pill and dev model pickers for screenshots"
              type="toggle"
              toggleValue={devHideDevControls}
              onToggle={setDevHideDevControls}
              isDev
              showDivider={false}
            />
          </SettingsSectionBlock>

          <SettingsSectionBlock flat style={styles.subBlock}>
            <SettingsRow
              title="Mock name and photo"
              subtitle="Shows a generic name and avatar on Home, Settings and Profile"
              type="toggle"
              toggleValue={devMockIdentity}
              onToggle={setDevMockIdentity}
              isDev
              showDivider={false}
            />
          </SettingsSectionBlock>

          </>
          ) : null}

          {/* Section 0: Anchor 2.0 Features & QA Labs */}
          {embedded ? null : <SettingsSectionBlock flat>
            {renderAccordionHeader(
              'Anchor 2.0 Work & QA Labs',
              'Creation, Vision, Chart & Demo Data',
              showV2Tools,
              () => setShowV2Tools((c) => !c)
            )}
            {showV2Tools ? (
              <>
                <SettingsRow
                  title="Seed Demo Anchor + Vision + Chart"
                  subtitle="Populates full Anchor with Vision board & Chart"
                  type="none"
                  onPress={() => {
                    seedV2DemoAnchor();
                    setDevStatusMessage('Seeded demo Anchor with Vision board and Chart course.');
                  }}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Seed</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="V2 Creation Flow"
                  subtitle="Intention → Distill → Etch → Pager → Hold to Seal"
                  type="none"
                  onPress={() => navigation?.navigate('V2Creation')}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Launch</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Vision Visual QA Lab"
                  subtitle="Full Vision board, 2-up, moment inputs, and camera"
                  type="none"
                  onPress={() => DeviceEventEmitter.emit('openVisionVisualQA', { surface: '2' })}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Open</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Creation Flow QA Lab"
                  subtitle="Isolated creation testing with local fixtures"
                  type="none"
                  onPress={() => DeviceEventEmitter.emit('openCreationFlowQA', { start: 'intention' })}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Open</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Chart Motion Lab"
                  subtitle="Interactive 2.5D route map & waypoints"
                  type="none"
                  onPress={() => DeviceEventEmitter.emit('openChartLab')}
                  isDev
                  showDivider={false}
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Open</Text>
                    </View>
                  }
                />
              </>
            ) : null}
          </SettingsSectionBlock>}

          {embedded ? <Text style={styles.groupLabel} accessibilityRole="header">Account & access</Text> : null}
          {/* Section B: Subscription & Paywall Testing */}
          <SettingsSectionBlock flat style={styles.subBlock}>
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

          {/* Section A: Onboarding & First-Run */}
          <SettingsSectionBlock flat style={styles.subBlock}>
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

          {embedded ? <Text style={styles.groupLabel} accessibilityRole="header">Anchor & practice</Text> : null}
          {/* Section C: Anchor & State Testing */}
          <SettingsSectionBlock flat style={styles.subBlock}>
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

          {embedded ? <Text style={styles.groupLabel} accessibilityRole="header">Device & diagnostics</Text> : null}
          {/* Section G: Screen Orientation (Dev Only) */}
          <SettingsSectionBlock flat style={styles.subBlock}>
            {renderAccordionHeader(
              'Orientation & Layout (Dev Only)',
              `Mode: ${devOrientation === 'sensor' ? 'Auto (Sensor)' : devOrientation === 'landscape' ? 'Landscape' : 'Portrait'}`,
              showOrientationTools,
              () => setShowOrientationTools((c) => !c)
            )}
            {showOrientationTools ? (
              <View style={styles.segmentRow}>
                <View style={styles.perfTierHeader}>
                  <Text style={styles.segmentTitle}>Screen Orientation Lock</Text>
                  <Text style={styles.perfTierDetected}>
                    Active: {devOrientation.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.segmentedControl}>
                  {DEV_ORIENTATION_OPTIONS.map(({ value, label }) => {
                    const selected = devOrientation === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={`Set orientation to ${label}`}
                        onPress={() => void handleOrientationChange(value)}
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
                  Auto allows device tilt rotation. Landscape forces horizontal layout for QA. Dev builds only; production stays locked to portrait.
                </Text>
              </View>
            ) : null}
          </SettingsSectionBlock>

          {/* Section F: Performance & Debug Logging */}
          <SettingsSectionBlock flat style={styles.subBlock}>
            {renderAccordionHeader(
              'Performance & Debug Flags',
              embedded ? 'Console logs and runtime diagnostics' : 'Visual tiers and console logs',
              showDebugTools,
              () => setShowDebugTools((c) => !c)
            )}
            {showDebugTools ? (
              <>
                {embedded ? null : <PerfTierPicker />}
                <SettingsRow
                  title="Debug Console Logging"
                  subtitle="Verbose telemetry & network logs"
                  type="toggle"
                  toggleValue={debugLoggingEnabled}
                  onToggle={setDebugLoggingEnabled}
                  isDev
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          {/* Section E: Notification Tester */}
          <SettingsSectionBlock flat style={styles.subBlock}>
            {renderAccordionHeader(
              'Notification Tester',
              `Schedule test payloads with +${TEST_NOTIFICATION_DELAY_SECONDS}s delay`,
              showNotificationTools,
              () => setShowNotificationTools((c) => !c)
            )}
            {showNotificationTools ? (
              <>
                <SettingsRow
                  title="Weekly Summary 2.0 Preview"
                  subtitle="Open the 2.0 weekly recap now"
                  type="none"
                  disabled={!onWeeklySummaryPrimed}
                  onPress={() => {
                    setDevStatusMessage('Opening Weekly Summary 2.0.');
                    onWeeklySummaryPrimed?.();
                  }}
                  isDev
                  rightElement={
                    <View style={styles.actionBadge}>
                      <Text style={styles.actionBadgeText}>Prime</Text>
                    </View>
                  }
                  showDivider={false}
                />
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

          {embedded ? <Text style={styles.groupLabel} accessibilityRole="header">Reference</Text> : null}
          {/* Section D: Recommendation Outcomes */}
          <SettingsSectionBlock flat style={styles.subBlock}>
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
                <Text style={styles.outcomeDescription}>
                  {devRecommendationAction
                    ? `Today card forced to ${devRecommendationAction} on this device. Nothing is sent to the server.`
                    : 'Today card shows the real recommendation.'}
                </Text>
                {devRecommendationAction ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Use real recommendation on the Today card"
                    onPress={() => setDevRecommendationAction(null)}
                    style={styles.outcomeButton}
                  >
                    <Text style={styles.outcomeButtonText}>Use real recommendation</Text>
                  </Pressable>
                ) : null}
                {OUTCOME_CARDS.map((outcome) => {
                  const isForced = devRecommendationAction === outcome.action;
                  return (
                    <View key={outcome.action} style={styles.outcomeCard}>
                      <Text style={styles.outcomeTitle}>{outcome.title}</Text>
                      <Text style={styles.outcomeDetail}>{outcome.detail}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isForced }}
                        accessibilityLabel={`Force ${outcome.action} on the Today card`}
                        onPress={() => setDevRecommendationAction(outcome.action)}
                        style={[styles.outcomeButton, isForced && styles.outcomeButtonActive]}
                      >
                        <Text style={[styles.outcomeButtonText, isForced && styles.outcomeButtonTextActive]}>
                          {isForced ? 'Forced on device' : 'Force on device'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
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
          {embedded ? <Text style={styles.groupLabel} accessibilityRole="header">Reset</Text> : null}
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
  wrapper: { marginVertical: 0 },
  groupLabel: { ...devMenuStyles.sectionLabel, marginTop: 12 },
  contentContainer: { gap: 0 },
  subBlock: { marginTop: 0 },
  accordionHeader: { ...devMenuStyles.actionRow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  accordionHeaderPressed: { opacity: 0.65 },
  accordionHeaderCopy: { flex: 1, marginRight: 10 },
  accordionTitle: devMenuStyles.actionRowText,
  accordionDescription: devMenuStyles.hint,
  accordionChevron: { color: colors.ink.base, fontSize: 20 },
  accordionChevronExpanded: { transform: [{ rotate: '90deg' }] },
  segmentRow: { paddingVertical: 8, marginBottom: 8 },
  segmentTitle: devMenuStyles.sectionLabel,
  segmentedControl: devMenuStyles.chipRow,
  segmentButton: { ...devMenuStyles.chip, alignItems: 'center' },
  segmentButtonSelected: devMenuStyles.chipActive,
  segmentText: devMenuStyles.chipText,
  segmentTextSelected: devMenuStyles.chipTextActive,
  segmentHint: devMenuStyles.hint,
  perfTierHeader: { gap: 4, marginBottom: 4 },
  perfTierDetected: devMenuStyles.hint,
  perfTierHint: devMenuStyles.hint,
  actionBadge: { flexShrink: 1 },
  actionBadgeText: { color: colors.text.secondary, fontSize: 11, fontWeight: '600' },
  anchorSwitcher: { paddingVertical: 8 },
  emptyText: devMenuStyles.hint,
  anchorRow: { ...devMenuStyles.actionRow, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  anchorRowActive: devMenuStyles.chipActive,
  anchorRowText: { ...devMenuStyles.chipText, flex: 1 },
  anchorRowTextActive: devMenuStyles.chipTextActive,
  activePill: { marginLeft: 4 },
  activePillText: { color: '#FAF7F2', fontSize: 9, fontWeight: '700' },
  outcomeContainer: { marginBottom: 8, gap: 8 },
  outcomeDescription: devMenuStyles.hint,
  outcomeCard: { ...devMenuStyles.actionRow, marginBottom: 0 },
  outcomeTitle: devMenuStyles.actionRowText,
  outcomeDetail: devMenuStyles.hint,
  outcomeButton: { ...devMenuStyles.chip, marginTop: 8, alignSelf: 'flex-start' },
  outcomeButtonActive: devMenuStyles.chipActive,
  outcomeButtonText: devMenuStyles.chipText,
  outcomeButtonTextActive: devMenuStyles.chipTextActive,
  statusBox: { ...devMenuStyles.actionRow, borderLeftWidth: 3, borderLeftColor: colors.ink.base },
  statusBoxLabel: devMenuStyles.sectionLabel,
  statusBoxText: { color: colors.ink.base, fontSize: 12 },
  masterResetButton: { ...devMenuStyles.actionRowDanger, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  masterResetButtonPressed: { opacity: 0.65 },
  masterResetTitle: devMenuStyles.actionRowDangerText,
  masterResetSubtext: { ...devMenuStyles.hint, color: '#A02020' },
  masterResetChevron: { color: '#A02020', fontSize: 18 },
  devToolsHeader: { ...devMenuStyles.actionRow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  devToolsHeaderPressed: { opacity: 0.65 },
  devToolsHeaderContent: { flex: 1 },
  devToolsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: devMenuStyles.actionRowText,
  buildBadge: { backgroundColor: colors.ink.base, borderRadius: radii.sm, padding: 4 },
  buildBadgeText: { color: '#FAF7F2', fontSize: 9, fontWeight: '700' },
  description: devMenuStyles.hint,
  devToolsChevron: { color: colors.ink.base, fontSize: 18 },
  devToolsChevronExpanded: { transform: [{ rotate: '90deg' }] },
});
