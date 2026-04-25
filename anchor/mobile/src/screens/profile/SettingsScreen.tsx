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
  Linking,
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
// DEFERRED: freemium — useSubscription replaced with useTrialStatus for trial model
// import { useSubscription } from '@/hooks/useSubscription';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';
import NotificationService from '@/services/NotificationService';
import { apiClient } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import revenueCatService from '@/services/RevenueCatService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

const IS_ANDROID = Platform.OS === 'android';
const SHOULD_ANIMATE_SECTION_ENTRANCE = Platform.OS === 'ios';
const DEV_SUBSCRIPTION_TIER_OPTIONS = [
  { value: 'pro', label: 'PAID' },
  { value: 'trial', label: 'TRIAL' },
  { value: 'expired', label: 'EXPIRED' },
] as const;

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
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user, signOut, setHasCompletedOnboarding } = useAuthStore();
  const settings = useSettingsStore();
  const subStore = useSubscriptionStore();
  // DEFERRED: freemium — { tier, isPro } replaced with trial-aware status
  // const { tier, isPro } = useSubscription();
  const { isTrialActive, isSubscribed, hasExpired, daysRemaining } = useTrialStatus();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const reveal = useSettingsReveal();
  const shouldAnimateSections = SHOULD_ANIMATE_SECTION_ENTRANCE && !reduceMotionEnabled;

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [deferredSectionsReady, setDeferredSectionsReady] = useState(false);

  const section0 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section1 = useSharedValue(shouldAnimateSections ? 0 : 1);
  const section2 = useSharedValue(shouldAnimateSections ? 0 : 1);
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
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await AuthService.signOut();
            signOut();
          } catch (error: any) {
            Alert.alert('Sign Out Failed', error?.message || 'Failed to sign out.');
          }
        },
      },
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
            const firebaseUser = auth().currentUser;
            if (firebaseUser) {
              await firebaseUser.delete();
            }
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

  const openStoreSubscriptions = () => {
    const url =
      Platform.OS === 'android'
        ? 'https://play.google.com/store/account/subscriptions'
        : 'https://apps.apple.com/account/subscriptions';
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open the store. Please manage your subscription through the App Store.')
    );
  };

  // DEFERRED: freemium — handleUpgradeToPro removed; upgrade now routes to Paywall screen
  // const handleUpgradeToPro = () => {
  //   openStoreSubscriptions();
  // };

  const handleRestorePurchase = async () => {
    try {
      const status = await revenueCatService.restorePurchases();
      if (status.hasActiveEntitlement) {
        Alert.alert('Restored', 'Your subscription has been successfully restored.');
      } else {
        Alert.alert('Nothing to Restore', 'No active subscription found for this account.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message || 'Could not restore purchases. Please try again.');
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@getanchor.app').catch(() =>
      Alert.alert('Contact Support', 'Email us at support@getanchor.app')
    );
  };

  const CardWrapper = View;
  const cardProps = {};
  const selectedDevTier =
    subStore.devTierOverride === 'free' ? 'expired' : subStore.devTierOverride;

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
                label="Hide Intention Text"
                helperText="During priming, show only the anchor"
                value={settings.reduceIntentionVisibility}
                onValueChange={settings.setReduceIntentionVisibility}
              />
            </CardWrapper>
          </Animated.View>

              {deferredSectionsReady && (
            <>
              {/* Appearance section removed */}

              <Animated.View style={animatedStyle4}>
                <SectionHeader title="Audio & Haptics" />
                <CardWrapper {...cardProps} style={styles.section}>
                  <SettingItem
                    label="Haptic Feedback"
                    value={settings.hapticIntensity < 34 ? 'Light' : settings.hapticIntensity < 67 ? 'Medium' : 'Strong'}
                    onPress={() => navigation.navigate('HapticIntensity')}
                  />
                  <ToggleItem
                    label="Sound"
                    helperText="Audio feedback during forge and prime sessions."
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
                  description="Your membership unlocks the full Anchor experience."
                />
                <CardWrapper {...cardProps} style={styles.section}>
                  {isSubscribed && (
                    <SettingItem
                      label="Current Plan"
                      value="Active"
                      showChevron={false}
                    />
                  )}
                  {isTrialActive && (
                    <SettingItem
                      label="Free Trial"
                      value={`${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`}
                      showChevron={false}
                    />
                  )}
                  {hasExpired && (
                    <>
                      <SettingItem
                        label="Trial Status"
                        value="Expired"
                        showChevron={false}
                      />
                      {/* DEFERRED: freemium — Upgrade to Pro button replaced with Subscribe CTA */}
                      <TouchableOpacity
                        style={styles.upgradeButton}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('Paywall' as any)}
                      >
                        <LinearGradient
                          colors={[colors.gold, colors.bronze]}
                          style={styles.upgradeGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.upgradeButtonText}>Subscribe to Anchor</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}
                  <SettingItem label="Restore Purchase" onPress={handleRestorePurchase} showChevron={false} />
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
                  <SettingItem label="Contact Support" onPress={handleContactSupport} />
                </CardWrapper>
              </Animated.View>

              {__DEV__ && (
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
                              {DEV_SUBSCRIPTION_TIER_OPTIONS.map(({ value, label }) => (
                                <TouchableOpacity
                                  key={value}
                                  style={[
                                    styles.segmentButton,
                                    selectedDevTier === value && styles.activeSegment,
                                  ]}
                                  onPress={() => subStore.setDevTierOverride(value)}
                                >
                                  <Text
                                    style={[
                                      styles.segmentText,
                                      selectedDevTier === value && styles.activeSegmentText,
                                    ]}
                                  >
                                    {label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                        <ToggleItem
                          label="Master Account (Bypass All)"
                          helperText="Grant full pro access regardless of subscription state."
                          value={settings.developerMasterAccountEnabled}
                          onValueChange={settings.setDeveloperMasterAccountEnabled}
                        />
                        <ToggleItem
                          label="Skip Onboarding"
                          value={settings.developerSkipOnboardingEnabled}
                          onValueChange={settings.setDeveloperSkipOnboardingEnabled}
                        />
                        <ToggleItem
                          label="Force Streak Break"
                          helperText="Simulate a streak break in the Sanctuary."
                          value={settings.developerForceStreakBreakEnabled}
                          onValueChange={settings.setDeveloperForceStreakBreakEnabled}
                        />
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

        </ScrollView>
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
