/**
 * Anchor App - Settings Screen
 *
 * Comprehensive settings interface with 8 sections:
 * Practice, Notifications, Appearance, Audio & Haptics,
 * Account, Subscription, Data & Privacy, and About.
 *
 * Fully wired to settingsStore with all interactive controls.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  Zap,
  Bell,
  Palette,
  Volume2,
  User,
  Crown,
  Shield,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import {
  SettingsSection,
  SettingsRow,
  ToggleSetting,
  SliderSetting,
  PickerSetting,
  ButtonSetting,
} from '@/components/settings';
import {
  getHapticStrengthLabel,
  getMantraVoiceLabel,
  getVoiceStyleLabel,
  useSettingsStore,
} from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ToastProvider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { CacheService } from '@/services/CacheService';
import { LEGAL_URLS } from '@/config';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/types';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const toast = useToast();
  const { isOnline, pendingActions } = useOfflineStatus();
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Settings state
  const {
    defaultChargeType,
    setDefaultChargeType,
    defaultActivationType,
    setDefaultActivationType,
    autoOpenDailyAnchor,
    setAutoOpenDailyAnchor,
    dailyPracticeGoal,
    setDailyPracticeGoal,
    reduceIntentionVisibility,
    setReduceIntentionVisibility,
    dailyReminderEnabled,
    setDailyReminderEnabled,
    streakProtectionEnabled,
    setStreakProtectionEnabled,
    weeklyReflectionEnabled,
    setWeeklyReflectionEnabled,
    theme,
    setTheme,
    vaultView,
    setVaultView,
    mantraVoice,
    voiceStyle,
    hapticStrength,
    soundEffectsEnabled,
    setSoundEffectsEnabled,
  } = useSettingsStore();

  const { user, signOut } = useAuthStore();
  const pendingCount = pendingActions.length;
  const offlineSubtitle = pendingCount > 0 ? `${pendingCount} pending` : 'All synced';
  const connectionLabel = isOnline ? 'Online' : 'Offline';

  const mantraVoiceLabel = getMantraVoiceLabel(mantraVoice);
  const voiceStyleLabel = getVoiceStyleLabel(voiceStyle);
  const hapticStrengthLabel = getHapticStrengthLabel(hapticStrength);

  // Handlers
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Sign Out',
        onPress: () => {
          signOut();
        },
        style: 'destructive',
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: () => {},
          style: 'destructive',
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear local cache?',
      'This removes temporary files. Your anchors and account remain safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            if (isClearingCache) return;
            setIsClearingCache(true);
            try {
              const result = await CacheService.clearLocalCache();
              if (result.failed.length > 0) {
                toast.warning('Cache cleared with some items skipped.');
              } else {
                toast.success('Cache cleared.');
              }
            } catch (error) {
              console.error('Failed to clear cache:', error);
              toast.error('Unable to clear cache.');
            } finally {
              setIsClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenURL = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open this link.');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Personalize how you practice, focus, and engage with Anchor.
          </Text>
        </View>

        {/* 1. PRACTICE SETTINGS */}
        <SettingsSection
          title="Practice Settings"
          description="Control how your anchors are created, charged, and activated."
          icon={Zap}
          defaultExpanded={true}
        >
          <PickerSetting
            label="Default Charge Type"
            description="Choose how much time you want to spend when charging a new anchor."
            value={defaultChargeType}
            onValueChange={setDefaultChargeType}
            options={[
              { label: 'Quick (30 seconds)', value: 'quick' },
              { label: 'Deep (5 minutes)', value: 'deep' },
            ]}
            showDivider={true}
          />
          <PickerSetting
            label="Default Activation"
            description="How you prefer to engage with your anchor during daily practice."
            value={defaultActivationType}
            onValueChange={setDefaultActivationType}
            options={[
              { label: 'Visual Focus', value: 'visual' },
              { label: 'Mantra', value: 'mantra' },
              { label: 'Full Practice', value: 'full' },
            ]}
            showDivider={true}
          />
          <ToggleSetting
            label="Open Daily Anchor Automatically"
            description="When enabled, your primary anchor opens when you launch the app."
            value={autoOpenDailyAnchor}
            onToggle={setAutoOpenDailyAnchor}
            showDivider={true}
          />
          <SliderSetting
            label="Daily Practice Goal"
            description="Set how many activations you aim for each day."
            value={dailyPracticeGoal}
            onValueChange={setDailyPracticeGoal}
            minimumValue={1}
            maximumValue={10}
            step={1}
            valueFormatter={(val) => `${val} activation${val !== 1 ? 's' : ''}`}
            showDivider={true}
          />
          <ToggleSetting
            label="Reduce Intention Visibility"
            description="Gradually hides original intention text to support focus without overthinking."
            value={reduceIntentionVisibility}
            onToggle={setReduceIntentionVisibility}
            showDivider={false}
          />
        </SettingsSection>

        {/* 2. NOTIFICATIONS */}
        <SettingsSection
          title="Notifications"
          description="Gentle reminders to support consistency."
          icon={Bell}
          defaultExpanded={true}
        >
          <ToggleSetting
            label="Daily Reminder"
            description="Receive a reminder to activate your anchor."
            value={dailyReminderEnabled}
            onToggle={setDailyReminderEnabled}
            showDivider={true}
          />
          <ToggleSetting
            label="Streak Protection Alerts"
            description="Get notified before a streak is broken."
            value={streakProtectionEnabled}
            onToggle={setStreakProtectionEnabled}
            showDivider={true}
          />
          <ToggleSetting
            label="Weekly Summary"
            description="A short overview of your practice each week."
            value={weeklyReflectionEnabled}
            onToggle={setWeeklyReflectionEnabled}
            showDivider={false}
          />
        </SettingsSection>

        {/* 3. APPEARANCE */}
        <SettingsSection
          title="Appearance"
          description="Adjust how Anchor looks and feels."
          icon={Palette}
          defaultExpanded={true}
        >
          <PickerSetting
            label="Theme"
            description="Choose your visual style."
            value={theme}
            onValueChange={setTheme}
            options={[
              { label: 'Zen Architect', value: 'zen_architect' },
              { label: 'Dark', value: 'dark' },
              { label: 'Light (Experimental)', value: 'light' },
            ]}
            showDivider={true}
          />
          <SettingsRow
            label="Accent Color"
            description="Choose a highlight color used across the app."
            rightElement={
              <View style={styles.valueContainer}>
                <View
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: '#D4AF37' },
                  ]}
                />
              </View>
            }
            showDivider={true}
          />
          <PickerSetting
            label="Vault Layout"
            description="How anchors appear in your sanctuary."
            value={vaultView}
            onValueChange={setVaultView}
            options={[
              { label: 'Grid', value: 'grid' },
              { label: 'List', value: 'list' },
            ]}
            showDivider={false}
          />
        </SettingsSection>

        {/* 4. AUDIO & HAPTICS */}
        <SettingsSection
          title="Audio & Haptics"
          description="Fine-tune sound and feedback during practice."
          icon={Volume2}
          defaultExpanded={true}
        >
          <SettingsRow
            label="Mantra Voice"
            description={mantraVoiceLabel}
            onPress={() => navigation.navigate('MantraVoice')}
            rightElement={<ChevronRight color={colors.gold} size={16} />}
            showDivider={true}
          />
          <SettingsRow
            label="Voice Style"
            description={voiceStyleLabel}
            onPress={() => navigation.navigate('VoiceStyle')}
            rightElement={<ChevronRight color={colors.gold} size={16} />}
            showDivider={true}
          />
          <SettingsRow
            label="Haptic Feedback"
            description={hapticStrengthLabel}
            onPress={() => navigation.navigate('HapticFeedback')}
            rightElement={<ChevronRight color={colors.gold} size={16} />}
            showDivider={true}
          />
          <ToggleSetting
            label="Sound Effects"
            description="Ambient sounds during charging and activation."
            value={soundEffectsEnabled}
            onToggle={setSoundEffectsEnabled}
            showDivider={false}
          />
        </SettingsSection>

        {/* 5. ACCOUNT */}
        <SettingsSection
          title="Account"
          description="Manage your account and access."
          icon={User}
          defaultExpanded={true}
        >
          <SettingsRow
            label="Email Address"
            description={user?.email || 'Not signed in'}
            rightElement={null}
            showDivider={true}
          />
          <ButtonSetting
            label="Sign Out"
            description="End your current session."
            onPress={handleSignOut}
            showDivider={true}
          />
          <ButtonSetting
            label="Delete Account"
            description="Permanently remove your account and data."
            onPress={handleDeleteAccount}
            variant="destructive"
            showDivider={false}
          />
        </SettingsSection>

        {/* 6. SUBSCRIPTION */}
        <SettingsSection
          title="Subscription"
          description="Manage your plan and access premium features."
          icon={Crown}
          defaultExpanded={true}
        >
          <SettingsRow
            label="Current Plan"
            description="Your subscription status."
            rightElement={
              <Text style={styles.value}>Free</Text>
            }
            showDivider={true}
          />
          <ButtonSetting
            label="Pro Benefits"
            description="Unlimited anchors, Advanced customization, Manual creation tools."
            onPress={() => {}}
            showDivider={true}
          />
          <ButtonSetting
            label="Upgrade to Pro"
            description="Unlock advanced features and unlimited anchors."
            onPress={() => {}}
            showDivider={true}
          />
          <ButtonSetting
            label="Restore Purchase"
            description="Sync purchases from another device."
            onPress={() => {}}
            showDivider={false}
          />
        </SettingsSection>

        {/* 7. DATA & PRIVACY */}
        <SettingsSection
          title="Data & Privacy"
          description="Control your data and storage."
          icon={Shield}
          defaultExpanded={true}
        >
          <ButtonSetting
            label="Export My Data"
            description="Download a copy of your account data."
            onPress={() => navigation.navigate('ExportData')}
            showDivider={true}
          />
          <ButtonSetting
            label="Clear Local Cache"
            description="Removes temporary files stored on this device."
            onPress={handleClearCache}
            isLoading={isClearingCache}
            showDivider={true}
          />
          <SettingsRow
            label="Offline Status"
            description={offlineSubtitle}
            onPress={() => navigation.navigate('OfflineStatus')}
            rightElement={
              <Text style={[styles.value, isOnline ? styles.statusOnline : styles.statusOffline]}>
                {connectionLabel}
              </Text>
            }
            showDivider={true}
          />
          <ButtonSetting
            label="Privacy Policy"
            description="Our commitment to your data."
            onPress={() =>
              navigation.navigate('LegalWebView', {
                title: 'Privacy Policy',
                url: LEGAL_URLS.privacyPolicy,
              })
            }
            showDivider={true}
          />
          <ButtonSetting
            label="Terms of Service"
            description="Legal terms for using Anchor."
            onPress={() =>
              navigation.navigate('LegalWebView', {
                title: 'Terms of Service',
                url: LEGAL_URLS.termsOfService,
              })
            }
            showDivider={false}
          />
        </SettingsSection>

        {/* 8. ABOUT */}
        <SettingsSection
          title="About Anchor"
          description="Product information and support."
          icon={Info}
          defaultExpanded={true}
        >
          <View style={styles.philosophyContainer}>
            <Text style={styles.philosophyText}>
              Anchor is a visual focus tool built on proven psychological and
              symbolic principles. It exists to help you clarify intention, stay
              consistent, and release overthinking.
            </Text>
          </View>
          <SettingsRow
            label="App Version"
            description="1.0.0 (Build 1)"
            rightElement={null}
            showDivider={true}
          />
          <ButtonSetting
            label="Contact Support"
            description="Get help or share your thoughts."
            onPress={() => handleOpenURL('mailto:support@anchor.app')}
            showDivider={true}
          />
          <ButtonSetting
            label="Credits"
            description="Made with intention."
            onPress={() => {}}
            showDivider={false}
          />
        </SettingsSection>

        {/* Spacing for bottom safe area */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  headerSubtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '500',
  },
  statusOnline: {
    color: colors.success,
  },
  statusOffline: {
    color: colors.error,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  philosophyContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
  },
  philosophyText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    lineHeight: typography.lineHeights.body2,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});
