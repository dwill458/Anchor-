/**
 * Anchor App - Settings Screen
 * Finalized Zen Architect Design
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronRight,
  Bell,
  Zap,
  Sliders,
  ShieldCheck,
  Palette,
  Info,
  Code,
  LogOut,
  Trash2,
  Volume2,
  Clock,
  User,
  Crown
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useSubscription } from '@/hooks/useSubscription';
import type { RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';
import NotificationService from '@/services/NotificationService';
import { apiClient } from '@/services/ApiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IS_ANDROID = Platform.OS === 'android';

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

  // Developer Mode
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  // Time Picker State
  const [showTimePicker, setShowTimePicker] = useState(false);

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
      mantra: 'Mantra',
      full: 'Full Activation',
      breath_visual: 'Breath + Visual',
    };
    const unitLabels: Record<string, string> = {
      seconds: 's',
      reps: ' reps',
      minutes: 'min',
      breaths: ' breaths',
    };
    return `${typeLabels[settings.defaultActivation.type]} · ${settings.defaultActivation.value}${unitLabels[settings.defaultActivation.unit]}`;
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

  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  return (
    <View style={styles.container}>
      <ZenBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Personalize your path with Anchor's core configurations.</Text>
          </View>

          {/* 1. PRACTICE SETTINGS */}
          <SectionHeader title="Practice Settings" description="Control how your anchors are created, charged, and activated." />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem
              label="Default Charge"
              value={`${settings.defaultCharge.mode === 'focus' ? 'Focus' : 'Ritual'} · ${settings.defaultCharge.preset === 'custom' ? `Custom (${settings.defaultCharge.customMinutes}m)` : settings.defaultCharge.preset}`}
              onPress={() => navigation.navigate('DefaultCharge')}
            />
            <SettingItem label="Default Activation" value={formatActivationValue()} onPress={() => navigation.navigate('DefaultActivation')} />
            <ToggleItem label="Open Daily Anchor Automatically" value={settings.openDailyAnchorAutomatically} onValueChange={settings.setOpenDailyAnchorAutomatically} />
            <SettingItem label="Daily Practice Goal" value={`${settings.dailyPracticeGoal} activations per day`} onPress={() => navigation.navigate('DailyPracticeGoal')} />
            <ToggleItem label="Reduce Intention Visibility" value={settings.reduceIntentionVisibility} onValueChange={settings.setReduceIntentionVisibility} />
          </CardWrapper>

          {/* 2. NOTIFICATIONS */}
          <SectionHeader title="Notifications" description="Gentle reminders to support consistency." />
          <CardWrapper {...cardProps} style={styles.section}>
            <ToggleItem label="Daily Reminder" value={settings.dailyReminderEnabled} onValueChange={handleToggleDailyReminder} />
            {settings.dailyReminderEnabled && (
              <SettingItem label="Reminder Time" value={settings.dailyReminderTime} onPress={() => setShowTimePicker(true)} />
            )}
            <ToggleItem label="Streak Protection Alerts" value={settings.streakProtectionAlerts} onValueChange={settings.setStreakProtectionAlerts} />
            <ToggleItem label="Weekly Summary" value={settings.weeklySummaryEnabled} onValueChange={settings.setWeeklySummaryEnabled} />
          </CardWrapper>

          {/* 3. APPEARANCE */}
          <SectionHeader title="Appearance" />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem label="Theme" value={settings.theme === 'zen_architect' ? 'Zen Architect' : 'System'} onPress={() => navigation.navigate('ThemeSelection')} />
            <SettingItem label="Accent Color" value={settings.accentColor === '#D4AF37' ? 'Gold' : 'Custom'} onPress={() => navigation.navigate('AccentColor')} />
          </CardWrapper>

          {/* 4. AUDIO & HAPTICS */}
          <SectionHeader title="Audio & Haptics" />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem label="Haptic Feedback" value={settings.hapticIntensity < 34 ? 'Light' : settings.hapticIntensity < 67 ? 'Medium' : 'Strong'} onPress={() => navigation.navigate('HapticIntensity')} />
            <ToggleItem label="Sound Effects" value={settings.soundEffectsEnabled} onValueChange={settings.setSoundEffectsEnabled} />
          </CardWrapper>

          {/* 5. ACCOUNT */}
          <SectionHeader title="Account" />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem label="Email Address" value={user?.email || 'Not signed in'} showChevron={false} />
            <SettingItem label="Sign Out" onPress={handleSignOut} showChevron={false} />
            <SettingItem label="Delete Account" onPress={handleDeleteAccount} isDestructive showChevron={false} />
          </CardWrapper>

          {/* 6. SUBSCRIPTION */}
          <SectionHeader title="Subscription" description="Manage your plan and access premium features." />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem label="Current Plan" value={tier.charAt(0).toUpperCase() + tier.slice(1)} showChevron={false} />
            <View style={styles.proBenefits}>
              <Text style={styles.proBenefitsTitle}>Pro Benefits</Text>
              <Text style={styles.proBenefitItem}>• Unlimited anchors</Text>
              <Text style={styles.proBenefitItem}>• Advanced customization</Text>
              <Text style={styles.proBenefitItem}>• Manual creation tools</Text>
            </View>
            {!isPro && (
              <TouchableOpacity style={styles.upgradeButton} activeOpacity={0.8}>
                <LinearGradient colors={[colors.gold, colors.bronze]} style={styles.upgradeGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <SettingItem label="Restore Purchase" onPress={() => { }} showChevron={false} />
          </CardWrapper>

          {/* 7. DATA & PRIVACY */}
          <SectionHeader title="Data & Privacy" />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem label="Data Management" onPress={() => navigation.navigate('DataPrivacy')} />
            <SettingItem label="Privacy Policy" onPress={() => navigation.navigate('DataPrivacy')} />
          </CardWrapper>

          {/* 8. ABOUT ANCHOR */}
          <SectionHeader title="About Anchor" />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem label="App Version" value="1.0.0" showChevron={false} />
            <SettingItem label="Contact Support" onPress={() => { }} />
          </CardWrapper>

          {/* 9. DEVELOPER TOOLS */}
          {(__DEV__ || process.env.EXPO_PUBLIC_DEV_TOOLS === 'true') && (
            <>
              <SectionHeader title="Developer Tools" description="Simulate subscription state for UI testing" />
              <CardWrapper {...cardProps} style={styles.section}>
                <ToggleItem label="Enable Developer Overrides" value={subStore.devOverrideEnabled} onValueChange={subStore.setDevOverrideEnabled} />
                {subStore.devOverrideEnabled && (
                  <View style={styles.segmentedContainer}>
                    <Text style={styles.segmentedLabel}>Simulated Subscription Tier</Text>
                    <View style={styles.segments}>
                      {(['free', 'pro'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.segmentButton, subStore.devTierOverride === t && styles.activeSegment]}
                          onPress={() => subStore.setDevTierOverride(t)}
                        >
                          <Text style={[styles.segmentText, subStore.devTierOverride === t && styles.activeSegmentText]}>{t.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <ToggleItem label="Developer Mode" value={devModeEnabled} onValueChange={setDevModeEnabled} />
                {devModeEnabled && <SettingItem label="Reset Onboarding" onPress={handleResetOnboarding} isDestructive />}
                <TouchableOpacity style={styles.devResetButton} onPress={() => subStore.resetOverrides()}>
                  <Text style={styles.devResetText}>Reset Developer Overrides</Text>
                </TouchableOpacity>
              </CardWrapper>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
        {showTimePicker && (
          <DateTimePicker
            value={(() => {
              const [h, m] = settings.dailyReminderTime.split(':').map(Number);
              const d = new Date();
              d.setHours(h, m, 0, 0);
              return d;
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
  title: { fontSize: 32, fontWeight: 'bold', color: colors.gold, marginBottom: spacing.xs, letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: colors.silver, lineHeight: 20, opacity: 0.8 },
  sectionHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.silver, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: spacing.xs, opacity: 0.6 },
  sectionDescription: { fontSize: 13, color: colors.silver, lineHeight: 18, opacity: 0.6 },
  section: { backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)', marginHorizontal: spacing.lg, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.15)' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' },
  settingContent: { flex: 1, marginRight: spacing.md },
  settingLabel: { fontSize: 16, fontWeight: '600', color: colors.bone, marginBottom: 4 },
  helperText: { fontSize: 13, color: colors.silver, lineHeight: 18, opacity: 0.7, marginTop: 2 },
  settingValue: { fontSize: 14, color: colors.gold, fontWeight: '500', marginTop: 6 },
  destructiveText: { color: colors.error },
  proBenefits: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  proBenefitsTitle: { fontSize: 14, fontWeight: '600', color: colors.bone, marginBottom: spacing.sm },
  proBenefitItem: { fontSize: 13, color: colors.silver, lineHeight: 22, opacity: 0.8 },
  upgradeButton: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: 12, overflow: 'hidden' },
  upgradeGradient: { height: 50, justifyContent: 'center', alignItems: 'center' },
  upgradeButtonText: { color: colors.navy, fontWeight: 'bold', fontSize: 16 },
  segmentedContainer: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' },
  segmentedLabel: { fontSize: 13, color: colors.silver, marginBottom: spacing.md, opacity: 0.8 },
  segments: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, padding: 2 },
  segmentButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  activeSegment: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.silver, opacity: 0.6 },
  activeSegmentText: { color: colors.bone, opacity: 1 },
  devResetButton: { padding: spacing.lg, alignItems: 'center' },
  devResetText: { fontSize: 13, color: colors.silver, opacity: 0.5, textDecorationLine: 'underline' },
  bottomSpacer: { height: 100 },
});
