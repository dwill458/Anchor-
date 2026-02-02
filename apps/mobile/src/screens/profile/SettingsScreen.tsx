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
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';

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
  const { defaultCharge, defaultActivation } = useSettingsStore();

  // Developer Mode
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  // Practice Settings
  const [autoOpenDaily, setAutoOpenDaily] = useState(false);
  const [reduceVisibility, setReduceVisibility] = useState(false);

  // Notifications
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakProtection, setStreakProtection] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);

  // Audio & Haptics
  const [soundEffects, setSoundEffects] = useState(true);

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

    return `${typeLabels[defaultActivation.type]} · ${defaultActivation.value}${unitLabels[defaultActivation.unit]}`;
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all associated data.\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
          },
        },
      ]
    );
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'This will take you back to the initial welcome screen. Your anchors and account data will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setHasCompletedOnboarding(false);
          },
        },
      ]
    )
  };

  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  return (
    <View style={styles.container}>
      <ZenBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>
              Personalize your path with Anchor's core configurations.
            </Text>
          </View>

          {/* 1. PRACTICE SETTINGS */}
          <SectionHeader
            title="Practice Settings"
            description="Control how your anchors are created, charged, and activated."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem
              label="Default Charge"
              helperText="Choose how much time you want to spend when charging a new anchor."
              value={`${defaultCharge.mode === 'focus' ? 'Focus' : 'Ritual'} · ${defaultCharge.preset === 'custom'
                ? `Custom (${defaultCharge.customMinutes}m)`
                : defaultCharge.preset
                }`}
              onPress={() => navigation.navigate('DefaultCharge')}
              showChevron={true}
            />
            <SettingItem
              label="Default Activation"
              helperText="How you prefer to engage with your anchor during daily practice."
              value={formatActivationValue()}
              onPress={() => navigation.navigate('DefaultActivation')}
              showChevron={true}
            />
            <ToggleItem
              label="Open Daily Anchor Automatically"
              helperText="When enabled, your primary anchor opens when you launch the app."
              value={autoOpenDaily}
              onValueChange={setAutoOpenDaily}
            />
            <SettingItem
              label="Daily Practice Goal"
              helperText="Set how many activations you aim for each day."
              value="3 activations per day"
              onPress={() => {/* TODO: Open stepper */ }}
            />
            <ToggleItem
              label="Reduce Intention Visibility"
              helperText="Gradually hides original intention text to support focus without overthinking."
              value={reduceVisibility}
              onValueChange={setReduceVisibility}
            />
          </CardWrapper>

          {/* 2. NOTIFICATIONS */}
          <SectionHeader
            title="Notifications"
            description="Gentle reminders to support consistency."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <ToggleItem
              label="Daily Reminder"
              helperText="Receive a reminder to activate your anchor."
              value={dailyReminder}
              onValueChange={setDailyReminder}
            />
            <ToggleItem
              label="Streak Protection Alerts"
              helperText="Get notified before a streak is broken."
              value={streakProtection}
              onValueChange={setStreakProtection}
            />
            <ToggleItem
              label="Weekly Summary"
              helperText="A short overview of your practice each week."
              value={weeklySummary}
              onValueChange={setWeeklySummary}
            />
          </CardWrapper>

          {/* 3. APPEARANCE */}
          <SectionHeader
            title="Appearance"
            description="Adjust how Anchor looks and feels."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem
              label="Theme"
              value="Zen Architect"
              onPress={() => {/* TODO: Open theme picker */ }}
            />
            <SettingItem
              label="Accent Color"
              value="Gold"
              onPress={() => {/* TODO: Open color picker */ }}
            />
            <SettingItem
              label="Vault View"
              value="Grid"
              onPress={() => {/* TODO: Toggle vault view */ }}
            />
          </CardWrapper>

          {/* 4. AUDIO & HAPTICS */}
          <SectionHeader
            title="Audio & Haptics"
            description="Personalize the sensory experience."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem
              label="Mantra Voice"
              value="Voice One"
              onPress={() => {/* TODO: Open voice picker */ }}
            />
            <SettingItem
              label="Voice Style"
              value="Calm"
              onPress={() => {/* TODO: Open style picker */ }}
            />
            <SettingItem
              label="Haptic Feedback"
              helperText="Adjust the strength of physical feedback."
              value="Medium"
              onPress={() => {/* TODO: Open intensity slider */ }}
            />
            <ToggleItem
              label="Sound Effects"
              helperText="Charging, activation, and completion sounds."
              value={soundEffects}
              onValueChange={setSoundEffects}
            />
          </CardWrapper>

          {/* 5. ACCOUNT */}
          <SectionHeader
            title="Account"
            description="Manage your account and access."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem
              label="Email Address"
              value={user?.email || 'Not signed in'}
              showChevron={false}
            />
            <SettingItem
              label="Sign Out"
              onPress={handleSignOut}
              showChevron={false}
            />
            <SettingItem
              label="Delete Account"
              onPress={handleDeleteAccount}
              isDestructive
              showChevron={false}
            />
          </CardWrapper>

          {/* 6. SUBSCRIPTION */}
          <SectionHeader
            title="Subscription"
            description="Manage your plan and access premium features."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem
              label="Current Plan"
              value="Free"
              showChevron={false}
            />
            <View style={styles.proBenefits}>
              <Text style={styles.proBenefitsTitle}>Pro Benefits</Text>
              <Text style={styles.proBenefitItem}>• Unlimited anchors</Text>
              <Text style={styles.proBenefitItem}>• Advanced customization</Text>
              <Text style={styles.proBenefitItem}>• Manual creation tools</Text>
            </View>
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
            <SettingItem
              label="Restore Purchase"
              onPress={() => {/* TODO: Restore purchases */ }}
              showChevron={false}
            />
          </CardWrapper>

          {/* 7. DATA & PRIVACY */}
          <SectionHeader
            title="Data & Privacy"
            description="Control your data and storage."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <SettingItem
              label="Export My Data"
              helperText="Download a copy of your account data."
              onPress={() => {/* TODO: Export data */ }}
            />
            <SettingItem
              label="Clear Local Cache"
              helperText="Removes temporary files stored on this device."
              onPress={() => {/* TODO: Clear cache */ }}
            />
            <SettingItem
              label="Offline Status"
              helperText="View pending actions waiting to sync."
              value="All synced"
              onPress={() => {/* TODO: Show offline status */ }}
            />
            <SettingItem
              label="Privacy Policy"
              onPress={() => {/* TODO: Open privacy policy */ }}
            />
            <SettingItem
              label="Terms of Service"
              onPress={() => {/* TODO: Open terms */ }}
            />
          </CardWrapper>

          {/* 8. ABOUT ANCHOR */}
          <SectionHeader
            title="About Anchor"
            description="Product information and support."
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <View style={styles.philosophyBox}>
              <Text style={styles.philosophyText}>
                Anchor is a visual focus tool built on proven psychological and symbolic principles.
                It exists to help you clarify intention, stay consistent, and release overthinking.
              </Text>
            </View>
            <SettingItem
              label="App Version"
              value="1.0.0"
              showChevron={false}
            />
            <SettingItem
              label="Contact Support"
              onPress={() => {/* TODO: Open support */ }}
            />
            <SettingItem
              label="Credits"
              onPress={() => {/* TODO: Show credits */ }}
            />
          </CardWrapper>

          {/* 9. DEVELOPER TOOLS */}
          <SectionHeader
            title="Developer Tools"
          />
          <CardWrapper {...cardProps} style={styles.section}>
            <ToggleItem
              label="Enable Developer Mode"
              helperText="Unlock internal tools and testing utilities."
              value={devModeEnabled}
              onValueChange={setDevModeEnabled}
            />
            {devModeEnabled && (
              <SettingItem
                label="Reset Onboarding"
                helperText="Restart the initial onboarding flow."
                onPress={handleResetOnboarding}
                isDestructive
              />
            )}
          </CardWrapper>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.silver,
    lineHeight: 20,
    opacity: 0.8,
  },
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
  settingContent: {
    flex: 1,
    marginRight: spacing.md,
  },
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
  destructiveText: {
    color: colors.error,
  },
  proBenefits: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  proBenefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: spacing.sm,
  },
  proBenefitItem: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 22,
    opacity: 0.8,
  },
  upgradeButton: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  philosophyBox: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    padding: spacing.lg,
    borderRadius: 12,
    margin: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  philosophyText: {
    fontSize: 14,
    color: colors.silver,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 100,
  },
});
