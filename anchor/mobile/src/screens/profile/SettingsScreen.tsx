/**
 * Anchor App - Settings Screen
 * Finalized Zen Architect Design
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import type { RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';
import NotificationService from '@/services/NotificationService';
import { apiClient } from '@/services/ApiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IS_ANDROID = Platform.OS === 'android';
const SHOULD_ANIMATE_SECTION_ENTRANCE = Platform.OS === 'ios';

type SettingItemProps = {
  label: string;
  helperText?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  isDestructive?: boolean;
};

type ToggleItemProps = {
  label: string;
  helperText?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

const SettingItem: React.FC<SettingItemProps> = ({
  label,
  helperText,
  value,
  onPress,
  showChevron = true,
  isDestructive = false,
}) => (
  <TouchableOpacity
    style={styles.settingItem}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.settingContent}>
      <Text style={[styles.settingLabel, isDestructive && styles.destructiveText]}>
        {label}
      </Text>
      {helperText && <Text style={styles.helperText}>{helperText}</Text>}
      {value && <Text style={styles.settingValue}>{value}</Text>}
    </View>
    {showChevron && onPress && (
      <ChevronRight color={isDestructive ? colors.error : colors.silver} size={20} />
    )}
  </TouchableOpacity>
);

const ToggleItem: React.FC<ToggleItemProps> = ({
  label,
  helperText,
  value,
  onValueChange,
}) => (
  <View style={styles.settingItem}>
    <View style={styles.settingContent}>
      <Text style={styles.settingLabel}>{label}</Text>
      {helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: colors.gold }}
      thumbColor={value ? colors.navy : colors.silver}
      ios_backgroundColor="rgba(255, 255, 255, 0.1)"
    />
  </View>
);

const SectionHeader: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {description && <Text style={styles.sectionDescription}>{description}</Text>}
  </View>
);

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut, setHasCompletedOnboarding } = useAuthStore();
  const settings = useSettingsStore();
  const subStore = useSubscriptionStore();
  const { tier, isPro } = useSubscription();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const reveal = useSettingsReveal();
  const shouldAnimateSections = SHOULD_ANIMATE_SECTION_ENTRANCE && !reduceMotionEnabled;

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [deferredSectionsReady, setDeferredSectionsReady] = useState(false);

  const section0 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section1 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section2 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section3 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section4 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section5 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section6 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section7 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section8 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section9 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const exitValue = useSharedValue(1);
  const previousCloseSignalRef = useRef(reveal.closeSignal);
  const hasMarkedReadyRef = useRef(false);
  const paintReadyFrameRef = useRef<number | null>(null);

  const animatedStyle0 = useAnimatedStyle(() => ({
    opacity: section0.value * exitValue.value,
    transform: [{ translateY: (1 - section0.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle1 = useAnimatedStyle(() => ({
    opacity: section1.value * exitValue.value,
    transform: [{ translateY: (1 - section1.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle2 = useAnimatedStyle(() => ({
    opacity: section2.value * exitValue.value,
    transform: [{ translateY: (1 - section2.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle3 = useAnimatedStyle(() => ({
    opacity: section3.value * exitValue.value,
    transform: [{ translateY: (1 - section3.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle4 = useAnimatedStyle(() => ({
    opacity: section4.value * exitValue.value,
    transform: [{ translateY: (1 - section4.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle5 = useAnimatedStyle(() => ({
    opacity: section5.value * exitValue.value,
    transform: [{ translateY: (1 - section5.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle6 = useAnimatedStyle(() => ({
    opacity: section6.value * exitValue.value,
    transform: [{ translateY: (1 - section6.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle7 = useAnimatedStyle(() => ({
    opacity: section7.value * exitValue.value,
    transform: [{ translateY: (1 - section7.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle8 = useAnimatedStyle(() => ({
    opacity: section8.value * exitValue.value,
    transform: [{ translateY: (1 - section8.value) * 14 + (1 - exitValue.value) * 6 }],
  }));
  const animatedStyle9 = useAnimatedStyle(() => ({
    opacity: section9.value * exitValue.value,
    transform: [{ translateY: (1 - section9.value) * 14 + (1 - exitValue.value) * 6 }],
  }));

  useEffect(() => {
    const entries = [
      section0,
      section1,
      section2,
      section3,
      section4,
      section5,
      section6,
      section7,
      section8,
      section9,
    ];

    exitValue.value = 1;

    if (!shouldAnimateSections) {
      entries.forEach((entry) => {
        entry.value = 1;
      });
      return;
    }

    const baseDelay = 35;
    const stepDelay = 28;
    const duration = 220;

    entries.forEach((entry) => {
      entry.value = 0;
    });

    entries.forEach((entry, index) => {
      entry.value = withDelay(
        baseDelay + stepDelay * index,
        withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
      );
    });
  }, [
    exitValue,
    shouldAnimateSections,
    section0,
    section1,
    section2,
    section3,
    section4,
    section5,
    section6,
    section7,
    section8,
    section9,
  ]);

  useEffect(() => {
    if (reveal.closeSignal === previousCloseSignalRef.current) {
      return;
    }
    previousCloseSignalRef.current = reveal.closeSignal;
    exitValue.value = withTiming(0, {
      duration: 160,
      easing: Easing.in(Easing.cubic),
    });
  }, [exitValue, reveal.closeSignal]);

  useEffect(() => {
    return () => {
      if (paintReadyFrameRef.current !== null) {
        cancelAnimationFrame(paintReadyFrameRef.current);
        paintReadyFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (!isCancelled) {
        setDeferredSectionsReady(true);
      }
    });

    const fallbackTimeout = setTimeout(() => {
      if (!isCancelled) {
        setDeferredSectionsReady(true);
      }
    }, 180);

    return () => {
      isCancelled = true;
      interactionTask.cancel?.();
      clearTimeout(fallbackTimeout);
    };
  }, []);

  const handleRootLayout = () => {
    if (hasMarkedReadyRef.current) {
      return;
    }

    if (paintReadyFrameRef.current !== null) {
      return;
    }

    paintReadyFrameRef.current = requestAnimationFrame(() => {
      paintReadyFrameRef.current = null;
      if (hasMarkedReadyRef.current) {
        return;
      }
      hasMarkedReadyRef.current = true;
      reveal.markSettingsReady();
    });
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate && event.type === 'set') {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      settings.setDailyReminderTime(timeString);

      if (settings.dailyReminderEnabled) {
        NotificationService.scheduleDailyReminder(timeString);
      }
    }
  };

  const handleToggleDailyReminder = async (value: boolean) => {
    settings.setDailyReminderEnabled(value);
    if (value) {
      const granted = await NotificationService.requestPermissions();
      if (granted) {
        await NotificationService.scheduleDailyReminder(settings.dailyReminderTime);
      } else {
        settings.setDailyReminderEnabled(false);
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
      }
    } else {
      await NotificationService.cancelDailyReminder();
    }
  };

  const formatActivationValue = () => {
    const typeLabels: Record<string, string> = {
      visual: 'Visual Focus',
      mantra: 'Mantra Focus',
      full: 'Full Focus',
      breath_visual: 'Full Focus',
    };

    if (settings.defaultActivation.unit === 'seconds') {
      const clampedSeconds = Math.min(
        60,
        Math.max(10, Math.round(settings.defaultActivation.value))
      );
      return `${typeLabels[settings.defaultActivation.type]} • ${clampedSeconds}s`;
    }

    const unit = settings.defaultActivation.unit === 'reps' ? ' reps' : ' min';
    return `${typeLabels[settings.defaultActivation.type]} • ${settings.defaultActivation.value}${unit}`;
  };

  const formatChargeValue = () => {
    const modeLabel = settings.defaultCharge.mode === 'focus' ? 'Quick Charge' : 'Ritual Charge';
    let durationLabel = '';

    if (settings.defaultCharge.preset === 'custom') {
      const customMinutes = Math.min(
        30,
        Math.max(1, Math.round(settings.defaultCharge.customMinutes ?? 5))
      );
      durationLabel = `${customMinutes} min`;
    } else {
      const presetLabels: Record<string, string> = {
        '30s': '30s',
        '1m': '1 min',
        '2m': '2 min',
        '5m': '5 min',
        '10m': '10 min',
      };
      durationLabel = presetLabels[settings.defaultCharge.preset] || settings.defaultCharge.preset;
    }

    return `${modeLabel} • ${durationLabel}`;
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This permanently deletes your account and all associated data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Account',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete('/auth/me');
            await AsyncStorage.clear();
            signOut();
          } catch (error: any) {
            Alert.alert('Deletion Failed', error.message || 'Failed to delete account.');
          }
        },
      },
    ]);
  };

  const handleResetOnboarding = () => {
    Alert.alert('Reset Onboarding', 'Restart the welcome screen?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setHasCompletedOnboarding(false) },
    ]);
  };

  const CardWrapper = View;
  const cardProps = {};

  return (
    <View style={styles.container} onLayout={handleRootLayout}>
      <ZenBackground showOrbs={false} animationDuration={0} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={animatedStyle0}>
            <View style={styles.header}>
              <Text style={styles.title}>Settings</Text>
              <Text style={styles.subtitle}>
                Personalize your path with Anchor's core configurations.
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={animatedStyle1}>
            <SectionHeader
              title="Practice Settings"
              description="Control how your anchors are created, charged, and activated."
            />
            <CardWrapper {...cardProps} style={styles.section}>
              <SettingItem
                label="Deep Charge Defaults"
                value={formatChargeValue()}
                onPress={() => navigation.navigate('DefaultCharge')}
              />
              <SettingItem
                label="Enter Focus Mode"
                value={formatActivationValue()}
                onPress={() => navigation.navigate('DefaultActivation')}
              />
              <ToggleItem
                label="Open Daily Anchor Automatically"
                value={settings.openDailyAnchorAutomatically}
                onValueChange={settings.setOpenDailyAnchorAutomatically}
              />
              <ToggleItem
                label="Guided Ritual Hints"
                helperText="Gentle in-context tips during new rituals. Turn it off and the app goes quiet."
                value={settings.guideMode}
                onValueChange={settings.setGuideMode}
              />
              <SettingItem
                label="Daily Focus Goal"
                value={`${settings.dailyPracticeGoal} Focus Bursts / day`}
                onPress={() => navigation.navigate('DailyPracticeGoal')}
              />
              <ToggleItem
                label="Reduce Intention Visibility"
                value={settings.reduceIntentionVisibility}
                onValueChange={settings.setReduceIntentionVisibility}
              />
            </CardWrapper>
          </Animated.View>

          {deferredSectionsReady && (
            <>
              <Animated.View style={animatedStyle2}>
                <SectionHeader title="Notifications" description="Gentle reminders to support consistency." />
                <CardWrapper {...cardProps} style={styles.section}>
                  <ToggleItem
                    label="Daily Reminder"
                    value={settings.dailyReminderEnabled}
                    onValueChange={handleToggleDailyReminder}
                  />
                  {settings.dailyReminderEnabled && (
                    <SettingItem
                      label="Reminder Time"
                      value={settings.dailyReminderTime}
                      onPress={() => setShowTimePicker(true)}
                    />
                  )}
                  <ToggleItem
                    label="Streak Protection Alerts"
                    value={settings.streakProtectionAlerts}
                    onValueChange={settings.setStreakProtectionAlerts}
                  />
                  <ToggleItem
                    label="Weekly Summary"
                    value={settings.weeklySummaryEnabled}
                    onValueChange={settings.setWeeklySummaryEnabled}
                  />
                </CardWrapper>
              </Animated.View>

              <Animated.View style={animatedStyle3}>
                <SectionHeader title="Appearance" />
                <CardWrapper {...cardProps} style={styles.section}>
                  <SettingItem
                    label="Theme"
                    value={settings.theme === 'zen_architect' ? 'Zen Architect' : 'System'}
                    onPress={() => navigation.navigate('ThemeSelection')}
                  />
                  <SettingItem
                    label="Accent Color"
                    value={settings.accentColor === '#D4AF37' ? 'Gold' : 'Custom'}
                    onPress={() => navigation.navigate('AccentColor')}
                  />
                </CardWrapper>
              </Animated.View>

              <Animated.View style={animatedStyle4}>
                <SectionHeader title="Audio & Haptics" />
                <CardWrapper {...cardProps} style={styles.section}>
                  <SettingItem
                    label="Haptic Feedback"
                    value={settings.hapticIntensity < 34 ? 'Light' : settings.hapticIntensity < 67 ? 'Medium' : 'Strong'}
                    onPress={() => navigation.navigate('HapticIntensity')}
                  />
                  <ToggleItem
                    label="Sound Effects"
                    value={settings.soundEffectsEnabled}
                    onValueChange={settings.setSoundEffectsEnabled}
                  />
                </CardWrapper>
              </Animated.View>

              <Animated.View style={animatedStyle5}>
                <SectionHeader title="Account" />
                <CardWrapper {...cardProps} style={styles.section}>
                  <SettingItem label="Email Address" value={user?.email || 'Not signed in'} showChevron={false} />
                  <SettingItem label="Sign Out" onPress={handleSignOut} showChevron={false} />
                  <SettingItem
                    label="Delete Account"
                    onPress={handleDeleteAccount}
                    isDestructive
                    showChevron={false}
                  />
                </CardWrapper>
              </Animated.View>

              <Animated.View style={animatedStyle6}>
                <SectionHeader
                  title="Subscription"
                  description="Manage your plan and access premium features."
                />
                <CardWrapper {...cardProps} style={styles.section}>
                  <SettingItem
                    label="Current Plan"
                    value={tier.charAt(0).toUpperCase() + tier.slice(1)}
                    showChevron={false}
                  />
                  <View style={styles.proBenefits}>
                    <Text style={styles.proBenefitsTitle}>Pro Benefits</Text>
                    <Text style={styles.proBenefitItem}>• Unlimited anchors</Text>
                    <Text style={styles.proBenefitItem}>• Advanced customization</Text>
                    <Text style={styles.proBenefitItem}>• Manual creation tools</Text>
                  </View>
                  {!isPro && (
                    <TouchableOpacity style={styles.upgradeButton} activeOpacity={0.8}>
                      <LinearGradient
                        colors={[colors.gold, colors.bronze]}
                        style={styles.upgradeGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  <SettingItem label="Restore Purchase" onPress={() => {}} showChevron={false} />
                </CardWrapper>
              </Animated.View>

              <Animated.View style={animatedStyle7}>
                <SectionHeader title="Data & Privacy" />
                <CardWrapper {...cardProps} style={styles.section}>
                  <SettingItem
                    label="Data Management"
                    onPress={() => navigation.navigate('DataPrivacy')}
                  />
                  <SettingItem
                    label="Privacy Policy"
                    onPress={() => navigation.navigate('DataPrivacy')}
                  />
                </CardWrapper>
              </Animated.View>

              <Animated.View style={animatedStyle8}>
                <SectionHeader title="About Anchor" />
                <CardWrapper {...cardProps} style={styles.section}>
                  <SettingItem label="App Version" value="1.0.0" showChevron={false} />
                  <SettingItem label="Contact Support" onPress={() => {}} />
                </CardWrapper>
              </Animated.View>

              {(__DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === 'true') && (
                <Animated.View style={animatedStyle9}>
                  <SectionHeader
                    title="Developer Tools"
                    description="Simulate subscription state for UI testing"
                  />
                  <CardWrapper {...cardProps} style={styles.section}>
                    <ToggleItem
                      label="Developer Mode"
                      value={settings.developerModeEnabled}
                      onValueChange={settings.setDeveloperModeEnabled}
                    />
                    {settings.developerModeEnabled && (
                      <>
                        <ToggleItem
                          label="Enable Developer Overrides"
                          value={subStore.devOverrideEnabled}
                          onValueChange={subStore.setDevOverrideEnabled}
                        />
                        {subStore.devOverrideEnabled && (
                          <View style={styles.segmentedContainer}>
                            <Text style={styles.segmentedLabel}>Simulated Subscription Tier</Text>
                            <View style={styles.segments}>
                              {(['free', 'pro'] as const).map((tierValue) => (
                                <TouchableOpacity
                                  key={tierValue}
                                  style={[
                                    styles.segmentButton,
                                    subStore.devTierOverride === tierValue && styles.activeSegment,
                                  ]}
                                  onPress={() => subStore.setDevTierOverride(tierValue)}
                                >
                                  <Text
                                    style={[
                                      styles.segmentText,
                                      subStore.devTierOverride === tierValue && styles.activeSegmentText,
                                    ]}
                                  >
                                    {tierValue.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                        <ToggleItem
                          label="Allow Direct Anchor Delete"
                          helperText="Show a developer-only delete action on anchor detail without burn ritual."
                          value={settings.developerDeleteWithoutBurnEnabled}
                          onValueChange={settings.setDeveloperDeleteWithoutBurnEnabled}
                        />
                        <ToggleItem
                          label="Debug Console Logging"
                          helperText="Verbose app logging in development builds only."
                          value={settings.debugLoggingEnabled}
                          onValueChange={settings.setDebugLoggingEnabled}
                        />
                        <SettingItem label="Reset Onboarding" onPress={handleResetOnboarding} isDestructive />
                        <TouchableOpacity
                          style={styles.devResetButton}
                          onPress={() => subStore.resetOverrides()}
                        >
                          <Text style={styles.devResetText}>Reset Developer Overrides</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </CardWrapper>
                </Animated.View>
              )}
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
        {showTimePicker && (
          <DateTimePicker
            value={(() => {
              const [hours, minutes] = settings.dailyReminderTime.split(':').map(Number);
              const date = new Date();
              date.setHours(hours, minutes, 0, 0);
              return date;
            })()}
            mode="time"
            is24Hour={true}
            onChange={onTimeChange}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 14, color: colors.silver, lineHeight: 20, opacity: 0.8 },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.silver,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    opacity: 0.6,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 18,
    opacity: 0.6,
  },
  section: {
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)',
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingContent: { flex: 1, marginRight: spacing.md },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 18,
    opacity: 0.7,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    color: colors.gold,
    fontWeight: '500',
    marginTop: 6,
  },
  destructiveText: { color: colors.error },
  proBenefits: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  proBenefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: spacing.sm,
  },
  proBenefitItem: { fontSize: 13, color: colors.silver, lineHeight: 22, opacity: 0.8 },
  upgradeButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: { height: 50, justifyContent: 'center', alignItems: 'center' },
  upgradeButtonText: { color: colors.navy, fontWeight: 'bold', fontSize: 16 },
  segmentedContainer: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  segmentedLabel: { fontSize: 13, color: colors.silver, marginBottom: spacing.md, opacity: 0.8 },
  segments: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 2,
  },
  segmentButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  activeSegment: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.silver, opacity: 0.6 },
  activeSegmentText: { color: colors.bone, opacity: 1 },
  devResetButton: { padding: spacing.lg, alignItems: 'center' },
  devResetText: {
    fontSize: 13,
    color: colors.silver,
    opacity: 0.5,
    textDecorationLine: 'underline',
  },
  bottomSpacer: { height: 100 },
});
