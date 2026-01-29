/**
 * Anchor App - Settings Screen
 *
 * User preferences and app settings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import {
  Bell,
  Clock,
  Shield,
  Grid,
  Vibrate,
  ChevronRight,
  Info,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';
import { ZenBackground, ScreenHeader } from '@/components/common';
import { useToast } from '@/components/ToastProvider';

const IS_ANDROID = Platform.OS === 'android';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList>;

interface ToggleSettingProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({
  icon,
  label,
  description,
  value,
  onValueChange,
}) => {
  const ItemWrapper = IS_ANDROID ? View : BlurView;
  const itemProps = IS_ANDROID ? {} : { intensity: 8, tint: 'dark' as const };

  return (
    <View style={styles.settingWrapper}>
      <ItemWrapper {...itemProps} style={styles.settingItem}>
        <View style={styles.settingLeft}>
          <View style={styles.settingIconContainer}>{icon}</View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>{label}</Text>
            {description && (
              <Text style={styles.settingDescription}>{description}</Text>
            )}
          </View>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#3e3e3e', true: colors.gold + '80' }}
          thumbColor={value ? colors.gold : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
        />
      </ItemWrapper>
    </View>
  );
};

interface SelectSettingProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: string;
  onPress: () => void;
}

const SelectSetting: React.FC<SelectSettingProps> = ({
  icon,
  label,
  description,
  value,
  onPress,
}) => {
  const ItemWrapper = IS_ANDROID ? View : BlurView;
  const itemProps = IS_ANDROID ? {} : { intensity: 8, tint: 'dark' as const };

  return (
    <TouchableOpacity
      style={styles.settingWrapper}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ItemWrapper {...itemProps} style={styles.settingItem}>
        <View style={styles.settingLeft}>
          <View style={styles.settingIconContainer}>{icon}</View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>{label}</Text>
            {description && (
              <Text style={styles.settingDescription}>{description}</Text>
            )}
          </View>
        </View>
        <View style={styles.settingRight}>
          <Text style={styles.settingValue}>{value}</Text>
          <ChevronRight color={colors.silver} size={20} />
        </View>
      </ItemWrapper>
    </TouchableOpacity>
  );
};

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const toast = useToast();

  // Settings state - would come from API in production
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [streakProtection, setStreakProtection] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState('08:00');
  const [defaultChargeDuration, setDefaultChargeDuration] = useState(5); // minutes
  const [hapticIntensity, setHapticIntensity] = useState(3);
  const [vaultViewType, setVaultViewType] = useState<'grid' | 'list'>('grid');

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNotificationsToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    toast.success(`Notifications ${value ? 'enabled' : 'disabled'}`);
    // TODO: Call API to update settings
  };

  const handleStreakProtectionToggle = (value: boolean) => {
    setStreakProtection(value);
    toast.success(`Streak protection ${value ? 'enabled' : 'disabled'}`);
    // TODO: Call API to update settings
  };

  const handleReminderTimePress = () => {
    // TODO: Open time picker
    toast.info('Time picker coming soon');
  };

  const handleChargeDurationPress = () => {
    Alert.alert(
      'Default Charge Duration',
      'Select default duration for charging rituals',
      [
        {
          text: '1 minute',
          onPress: () => {
            setDefaultChargeDuration(1);
            toast.success('Default duration set to 1 minute');
          },
        },
        {
          text: '5 minutes',
          onPress: () => {
            setDefaultChargeDuration(5);
            toast.success('Default duration set to 5 minutes');
          },
        },
        {
          text: '10 minutes',
          onPress: () => {
            setDefaultChargeDuration(10);
            toast.success('Default duration set to 10 minutes');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleHapticIntensityPress = () => {
    Alert.alert(
      'Haptic Intensity',
      'Select vibration strength for rituals',
      [
        {
          text: 'Light (1)',
          onPress: () => {
            setHapticIntensity(1);
            toast.success('Haptic intensity set to light');
          },
        },
        {
          text: 'Medium (3)',
          onPress: () => {
            setHapticIntensity(3);
            toast.success('Haptic intensity set to medium');
          },
        },
        {
          text: 'Strong (5)',
          onPress: () => {
            setHapticIntensity(5);
            toast.success('Haptic intensity set to strong');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleVaultViewPress = () => {
    Alert.alert(
      'Vault View',
      'Choose how to display your anchors',
      [
        {
          text: 'Grid',
          onPress: () => {
            setVaultViewType('grid');
            toast.success('Vault view set to grid');
          },
        },
        {
          text: 'List',
          onPress: () => {
            setVaultViewType('list');
            toast.success('Vault view set to list');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const getHapticLabel = (intensity: number) => {
    if (intensity <= 1) return 'Light';
    if (intensity >= 5) return 'Strong';
    return 'Medium';
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ZenBackground />

      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Settings" onBackPress={handleBack} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>

            <ToggleSetting
              icon={<Bell color={colors.silver} size={20} />}
              label="Enable Notifications"
              description="Receive reminders and streak alerts"
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
            />

            {notificationsEnabled && (
              <>
                <SelectSetting
                  icon={<Clock color={colors.silver} size={20} />}
                  label="Daily Reminder Time"
                  description="When to receive your daily reminder"
                  value={dailyReminderTime}
                  onPress={handleReminderTimePress}
                />

                <ToggleSetting
                  icon={<Shield color={colors.silver} size={20} />}
                  label="Streak Protection"
                  description="Get reminders before losing your streak"
                  value={streakProtection}
                  onValueChange={handleStreakProtectionToggle}
                />
              </>
            )}
          </View>

          {/* Ritual Defaults Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ritual Preferences</Text>

            <SelectSetting
              icon={<Clock color={colors.silver} size={20} />}
              label="Default Charge Duration"
              description="Suggested time for charging rituals"
              value={`${defaultChargeDuration} minutes`}
              onPress={handleChargeDurationPress}
            />

            <SelectSetting
              icon={<Vibrate color={colors.silver} size={20} />}
              label="Haptic Intensity"
              description="Vibration strength during rituals"
              value={getHapticLabel(hapticIntensity)}
              onPress={handleHapticIntensityPress}
            />
          </View>

          {/* Display Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Display</Text>

            <SelectSetting
              icon={<Grid color={colors.silver} size={20} />}
              label="Vault View"
              description="How your anchors are displayed"
              value={vaultViewType === 'grid' ? 'Grid' : 'List'}
              onPress={handleVaultViewPress}
            />
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            {IS_ANDROID ? (
              <View style={styles.infoCard}>
                <Info color={colors.silver} size={20} />
                <Text style={styles.infoText}>
                  Settings are automatically saved to your account.
                </Text>
              </View>
            ) : (
              <BlurView intensity={8} tint="dark" style={styles.infoCard}>
                <Info color={colors.silver} size={20} />
                <Text style={styles.infoText}>
                  Settings are automatically saved to your account.
                </Text>
              </BlurView>
            )}
          </View>

          {/* Bottom Spacer */}
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.silver,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    opacity: 0.6,
  },
  settingWrapper: {
    marginBottom: spacing.sm,
  },
  settingItem: {
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.85)' : 'rgba(26, 26, 29, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.silver,
    opacity: 0.7,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  settingValue: {
    fontSize: 14,
    color: colors.silver,
    marginRight: spacing.sm,
  },
  infoSection: {
    marginTop: spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.1)',
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.85)' : 'rgba(26, 26, 29, 0.3)',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.silver,
    lineHeight: 19,
    fontStyle: 'italic',
    marginLeft: spacing.md,
  },
  bottomSpacer: {
    height: 20,
  },
});
