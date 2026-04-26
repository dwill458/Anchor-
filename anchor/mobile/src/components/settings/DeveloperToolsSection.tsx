import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import NotificationService, { type NotificationType } from '@/services/NotificationService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useForgeMomentStore } from '@/stores/forgeMomentStore';
import { usePerformanceTier, type PerformanceTierOverride } from '@/hooks/usePerformanceTier';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { SettingsRow } from './SettingsRow';
import { SettingsSectionBlock } from './SettingsSectionBlock';

interface DeveloperToolsSectionProps {
  resetSettings: () => Promise<void> | void;
  onResetOnboarding: () => Promise<void> | void;
}

const TIERS: ReadonlyArray<{
  value: 'pro' | 'trial' | 'expired';
  label: string;
}> = [
  { value: 'pro', label: 'Paid' },
  { value: 'trial', label: 'Trial' },
  { value: 'expired', label: 'Expired' },
];

const PERF_TIERS: ReadonlyArray<{ value: PerformanceTierOverride; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Med' },
  { value: 'low', label: 'Low' },
];

const PerfTierPicker: React.FC = () => {
  const { devPerfTierOverride, setDevPerfTierOverride } = useSettingsStore((s) => ({
    devPerfTierOverride: s.devPerfTierOverride,
    setDevPerfTierOverride: s.setDevPerfTierOverride,
  }));
  // Detected tier (no override applied — shows what the device would actually get)
  const detectedTier = usePerformanceTier({ override: 'auto' });

  return (
    <View style={styles.segmentRow}>
      <View style={styles.perfTierHeader}>
        <Text style={styles.segmentTitle}>Performance Tier Override</Text>
        <Text style={styles.perfTierDetected}>Detected: {detectedTier}</Text>
      </View>
      <View style={styles.segmentedControl}>
        {PERF_TIERS.map(({ value, label }) => {
          const selected = devPerfTierOverride === value;
          return (
            <Pressable
              key={value}
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
        Forces render tier for all glow/animation components. Resets to Auto on app restart.
      </Text>
    </View>
  );
};
const TEST_NOTIFICATION_DELAY_SECONDS = 5;

const TEST_NOTIFICATION_OPTIONS: Array<{
  type: NotificationType;
  title: string;
  subtitle: string;
}> = [
  {
    type: 'daily_reminder',
    title: 'Test Daily Reminder',
    subtitle: 'Return-to-anchor reminder payload',
  },
  {
    type: 'daily_goal_checkpoint',
    title: 'Test Goal Checkpoint',
    subtitle: 'Daily progress checkpoint payload',
  },
  {
    type: 'ritual_reminder',
    title: 'Test Ritual Reminder',
    subtitle: 'Anchor ritual reminder payload',
  },
  {
    type: 'streak_protection',
    title: 'Test Streak Protection',
    subtitle: 'Momentum protection payload',
  },
  {
    type: 'weekly_summary',
    title: 'Test Weekly Summary',
    subtitle: 'Weekly reflection payload',
  },
];

export const DeveloperToolsSection: React.FC<DeveloperToolsSectionProps> = ({
  resetSettings,
  onResetOnboarding,
}) => {
  const anchors = useAnchorStore((state) => state.anchors);
  const currentAnchorId = useAnchorStore((state) => state.currentAnchorId);
  const updateAnchorState = useAnchorStore((state) => state.updateAnchor);
  const [isNotificationActionRunning, setIsNotificationActionRunning] = React.useState(false);
  const [notificationStatus, setNotificationStatus] = React.useState<string | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showCoreTools, setShowCoreTools] = React.useState(true);
  const [showNotificationTools, setShowNotificationTools] = React.useState(false);
  const [showWeeklyTools, setShowWeeklyTools] = React.useState(false);
  const [showMilestoneTools, setShowMilestoneTools] = React.useState(false);
  const subStore = useSubscriptionStore();
  const settingsStore = useSettingsStore();

  const selectedTier =
    subStore.devTierOverride === 'free' ? 'expired' : subStore.devTierOverride;
  const triggerDeveloperWeeklySummaryPreview = useSettingsStore(
    (state) => state.triggerDeveloperWeeklySummaryPreview
  );
  const resettableAnchor = React.useMemo(() => {
    const currentAnchor = currentAnchorId
      ? anchors.find((anchor) => anchor.id === currentAnchorId || anchor.localId === currentAnchorId)
      : undefined;

    if (currentAnchor) {
      return currentAnchor;
    }

    return anchors.find((anchor) => anchor.isCharged || (anchor.chargeCount ?? 0) > 0);
  }, [anchors, currentAnchorId]);
  const resettableAnchorLabel = resettableAnchor
    ? resettableAnchor.intentionText?.trim() || 'Untitled anchor'
    : 'No charged anchor available';

  const handleReset = () => {
    Alert.alert(
      'Reset Onboarding',
      'Restart from first launch state?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetSettings();
            await onResetOnboarding();
          },
        },
      ]
    );
  };

  const handleScheduleNotificationTest = async (
    type: NotificationType,
    label: string
  ): Promise<void> => {
    setIsNotificationActionRunning(true);

    try {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        const message =
          NotificationService.getLastError()?.message ??
          'Notification permissions were denied.';
        setNotificationStatus(message);
        Alert.alert('Notification Permission Required', message);
        return;
      }

      const identifier = await NotificationService.scheduleDeveloperTestNotification(
        type,
        TEST_NOTIFICATION_DELAY_SECONDS
      );

      if (!identifier) {
        const message =
          NotificationService.getLastError()?.message ??
          'Failed to schedule the notification test.';
        setNotificationStatus(message);
        Alert.alert('Notification Test Failed', message);
        return;
      }

      setNotificationStatus(
        `${label} scheduled for ${TEST_NOTIFICATION_DELAY_SECONDS} seconds from now.`
      );
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
        setNotificationStatus(error.message);
        Alert.alert('Notification Queue Error', error.message);
        return;
      }

      if (scheduled.length === 0) {
        const message = 'No developer notification tests are currently scheduled.';
        setNotificationStatus(message);
        Alert.alert('Scheduled Notification Tests', message);
        return;
      }

      const message = scheduled
        .map((notification, index) => `${index + 1}. ${notification.identifier}`)
        .join('\n');

      setNotificationStatus(`${scheduled.length} developer notification test(s) queued.`);
      Alert.alert('Scheduled Notification Tests', message);
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  const handleClearScheduledTests = async (): Promise<void> => {
    setIsNotificationActionRunning(true);

    try {
      const clearedCount = await NotificationService.cancelDeveloperTestNotifications();
      const error = NotificationService.getLastError();

      if (error) {
        setNotificationStatus(error.message);
        Alert.alert('Notification Queue Error', error.message);
        return;
      }

      const message =
        clearedCount === 0
          ? 'No developer notification tests were queued.'
          : `Cleared ${clearedCount} developer notification test${
              clearedCount === 1 ? '' : 's'
            }.`;

      setNotificationStatus(message);
    } finally {
      setIsNotificationActionRunning(false);
    }
  };

  const { queueMilestone } = useForgeMomentStore((state) => ({
    queueMilestone: state.queueMilestone,
  }));

  const RANK_MILESTONE_OPTIONS: Array<{
    name: string;
    label: string;
  }> = [
    {
      name: 'Practitioner',
      label: 'Practitioner Rank',
    },
    {
      name: 'Architect',
      label: 'Architect Rank',
    },
    {
      name: 'Sovereign',
      label: 'Sovereign Rank',
    },
  ];

  const handleQueueRankMilestone = async (rankName: string, label: string): Promise<void> => {
    const success = await queueMilestone({
      type: 'rank',
      name: rankName,
    });
    const message = success
      ? `${label} queued for display.`
      : `${label} already shown recently.`;
    setNotificationStatus(message);
  };

  const handleResetFirstPrimeState = () => {
    if (!resettableAnchor) {
      Alert.alert('No Anchor Available', 'Charge an anchor first, then reset it here for retesting.');
      return;
    }

    Alert.alert(
      'Reset First Prime State',
      `Reset "${resettableAnchorLabel}" back to an unprimed state?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await updateAnchorState(resettableAnchor.id, {
              isCharged: false,
              chargedAt: undefined,
              firstChargedAt: undefined,
              chargeCount: 0,
            });
            setNotificationStatus(`Reset "${resettableAnchorLabel}" for first-prime retesting.`);
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.accordionHeader, pressed ? styles.accordionHeaderPressed : null]}>
      <View style={styles.accordionHeaderCopy}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Text style={styles.accordionDescription}>{description}</Text>
      </View>
      <Text style={[styles.accordionChevron, expanded ? styles.accordionChevronExpanded : null]}>⌃</Text>
    </Pressable>
  );

  return (
    <View>
      <Pressable
        onPress={() => setIsExpanded((current) => !current)}
        style={({ pressed }) => [styles.devToolsHeader, pressed ? styles.devToolsHeaderPressed : null]}
      >
        <View>
          <Text style={styles.label}>⌥ Developer Tools</Text>
          <Text style={styles.description}>Build-only. Hidden in production.</Text>
        </View>
        <Text style={[styles.devToolsChevron, isExpanded ? styles.devToolsChevronExpanded : null]}>⌃</Text>
      </Pressable>

      {!isExpanded ? null : (
        <>
          <SettingsSectionBlock isDev>
            {renderAccordionHeader(
              'Core Overrides',
              'Developer flags, subscription overrides, and first-prime reset.',
              showCoreTools,
              () => setShowCoreTools((current) => !current)
            )}

            {showCoreTools ? (
              <>
                <SettingsRow
                  title="Developer Mode"
                  type="toggle"
                  toggleValue={settingsStore.developerModeEnabled}
                  onToggle={settingsStore.setDeveloperModeEnabled}
                  isDev
                />
                <SettingsRow
                  title="Enable Dev Overrides"
                  subtitle="Bypass paywalls & gate logic"
                  type="toggle"
                  toggleValue={subStore.devOverrideEnabled}
                  onToggle={subStore.setDevOverrideEnabled}
                  isDev
                />
                <SettingsRow
                  title="Master Account"
                  subtitle="Use a synthetic dev account and skip auth gates"
                  type="toggle"
                  toggleValue={settingsStore.developerMasterAccountEnabled}
                  onToggle={settingsStore.setDeveloperMasterAccountEnabled}
                  isDev
                />
                <PerfTierPicker />

                <View style={styles.segmentRow}>
                  <Text style={styles.segmentTitle}>Simulated Subscription Tier</Text>
                  <View style={styles.segmentedControl}>
                    {TIERS.map(({ value, label }) => {
                      const selected = selectedTier === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => subStore.setDevTierOverride(value)}
                          style={[
                            styles.segmentButton,
                            selected ? styles.segmentButtonSelected : null,
                          ]}
                        >
                          <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <SettingsRow
                  title="Skip Onboarding"
                  subtitle="Jump directly to home"
                  type="toggle"
                  toggleValue={settingsStore.developerSkipOnboardingEnabled}
                  onToggle={settingsStore.setDeveloperSkipOnboardingEnabled}
                  isDev
                />
                <SettingsRow
                  title="Allow Direct Anchor Delete"
                  subtitle="Delete without full ritual"
                  type="toggle"
                  toggleValue={settingsStore.developerDeleteWithoutBurnEnabled}
                  onToggle={settingsStore.setDeveloperDeleteWithoutBurnEnabled}
                  isDev
                />
                <SettingsRow
                  title="Debug Console Logging"
                  subtitle="Verbose app logging"
                  type="toggle"
                  toggleValue={settingsStore.debugLoggingEnabled}
                  onToggle={settingsStore.setDebugLoggingEnabled}
                  isDev
                />
                <SettingsRow
                  title="Force Streak Break"
                  subtitle="Test streak protection UI"
                  type="toggle"
                  toggleValue={settingsStore.developerForceStreakBreakEnabled}
                  onToggle={settingsStore.setDeveloperForceStreakBreakEnabled}
                  isDev
                />
                <SettingsRow
                  title="Reset First Prime State"
                  subtitle={resettableAnchorLabel}
                  type="none"
                  onPress={handleResetFirstPrimeState}
                  disabled={!resettableAnchor}
                  isDev
                  rightElement={
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>Reset</Text>
                    </View>
                  }
                  showDivider={false}
                />
              </>
            ) : null}
          </SettingsSectionBlock>

          <SettingsSectionBlock isDev style={styles.notificationBlock}>
            {renderAccordionHeader(
              'Notification Tester',
              `Schedule live test payloads in ${TEST_NOTIFICATION_DELAY_SECONDS} seconds.`,
              showNotificationTools,
              () => setShowNotificationTools((current) => !current)
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
                      <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>
                          +{TEST_NOTIFICATION_DELAY_SECONDS}s
                        </Text>
                      </View>
                    }
                  />
                ))}

                <SettingsRow
                  title="Show Scheduled Tests"
                  subtitle="List queued developer notification tests"
                  type="none"
                  onPress={() => void handleInspectScheduledTests()}
                  disabled={isNotificationActionRunning}
                  isDev
                  rightElement={
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>Queue</Text>
                    </View>
                  }
                />
                <SettingsRow
                  title="Clear Scheduled Tests"
                  subtitle="Remove queued developer notification tests"
                  type="none"
                  onPress={() => void handleClearScheduledTests()}
                  disabled={isNotificationActionRunning}
                  isDev
                  rightElement={
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>Clear</Text>
                    </View>
                  }
                  showDivider={false}
                />
              </>
            ) : null}

            {notificationStatus ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusLabel}>Developer Status</Text>
                <Text style={styles.statusText}>{notificationStatus}</Text>
              </View>
            ) : null}
          </SettingsSectionBlock>

          <SettingsSectionBlock isDev style={styles.notificationBlock}>
            {renderAccordionHeader(
              'Weekly Summary Preview',
              'Force the in-app weekly summary sheet to appear on the next Sanctuary visit.',
              showWeeklyTools,
              () => setShowWeeklyTools((current) => !current)
            )}

            {showWeeklyTools ? (
              <SettingsRow
                title="Show Weekly Summary Modal"
                subtitle="Open the in-app weekly review sheet"
                type="none"
                onPress={() => {
                  triggerDeveloperWeeklySummaryPreview();
                  setNotificationStatus('Weekly summary modal primed for preview.');
                }}
                isDev
                rightElement={
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>Open</Text>
                  </View>
                }
                showDivider={false}
              />
            ) : null}
          </SettingsSectionBlock>

          <SettingsSectionBlock isDev style={styles.notificationBlock}>
            {renderAccordionHeader(
              'Milestone Trigger Tests',
              'Queue rank achievements to test milestone popups.',
              showMilestoneTools,
              () => setShowMilestoneTools((current) => !current)
            )}

            {showMilestoneTools ? (
              <>
                {RANK_MILESTONE_OPTIONS.map((option, index) => (
                  <SettingsRow
                    key={option.name}
                    title={option.label}
                    type="none"
                    onPress={() => void handleQueueRankMilestone(option.name, option.label)}
                    isDev
                    rightElement={
                      <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>Show</Text>
                      </View>
                    }
                    showDivider={index < RANK_MILESTONE_OPTIONS.length - 1}
                  />
                ))}
              </>
            ) : null}
          </SettingsSectionBlock>

          <Pressable onPress={handleReset} style={({ pressed }) => [styles.resetButton, pressed ? styles.resetButtonPressed : null]}>
            <View>
              <Text style={styles.resetText}>Reset Onboarding</Text>
              <Text style={styles.resetSubtext}>Restart from first launch state</Text>
            </View>
            <Text style={styles.resetChevron}>›</Text>
          </Pressable>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  devToolsHeader: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(74,222,128,0.2)',
    backgroundColor: 'rgba(74,222,128,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  devToolsHeaderPressed: {
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  label: {
    color: '#4ade80',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  description: {
    color: '#4ade80',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
    opacity: 0.5,
  },
  devToolsChevron: {
    color: '#4ade80',
    fontSize: 16,
    opacity: 0.6,
    transform: [{ rotate: '180deg' }],
  },
  devToolsChevronExpanded: {
    transform: [{ rotate: '0deg' }],
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(74,222,128,0.2)',
  },
  accordionHeaderPressed: {
    backgroundColor: 'rgba(74,222,128,0.05)',
  },
  accordionHeaderCopy: {
    flex: 1,
    marginRight: 12,
  },
  accordionTitle: {
    color: '#4ade80',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  accordionDescription: {
    marginTop: 4,
    color: 'rgba(74,222,128,0.58)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  accordionChevron: {
    color: '#4ade80',
    fontSize: 14,
    opacity: 0.5,
    transform: [{ rotate: '180deg' }],
  },
  accordionChevronExpanded: {
    transform: [{ rotate: '0deg' }],
  },
  segmentRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(74,222,128,0.2)',
  },
  segmentTitle: {
    marginBottom: 8,
    color: '#4ade80',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    opacity: 0.9,
  },
  segmentedControl: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  segmentButton: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(74,222,128,0.2)',
    backgroundColor: 'rgba(74,222,128,0.04)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  segmentText: {
    color: '#4ade80',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    opacity: 0.5,
  },
  segmentTextSelected: {
    opacity: 1,
    fontFamily: 'Inter-SemiBold',
  },
  perfTierHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  perfTierDetected: {
    color: 'rgba(74,222,128,0.5)',
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  perfTierHint: {
    marginTop: 8,
    color: 'rgba(74,222,128,0.4)',
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    lineHeight: 14,
  },
  notificationBlock: {
    marginTop: 8,
  },
  notificationHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  notificationTitle: {
    color: '#4ade80',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  notificationDescription: {
    marginTop: 4,
    color: 'rgba(74,222,128,0.65)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  notificationBadge: {
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(74,222,128,0.25)',
    backgroundColor: 'rgba(74,222,128,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  notificationBadgeText: {
    color: '#4ade80',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(74,222,128,0.2)',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  statusLabel: {
    color: 'rgba(74,222,128,0.6)',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusText: {
    marginTop: 6,
    color: '#4ade80',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  resetButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  resetButtonPressed: {
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  resetText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  resetSubtext: {
    marginTop: 2,
    color: 'rgba(239,68,68,0.5)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  resetChevron: {
    color: '#ef4444',
    fontSize: 14,
    opacity: 0.5,
  },
});
