import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AnchorSettings } from '@/types/settings';
import { SettingsRow } from './SettingsRow';
import { SettingsSectionBlock } from './SettingsSectionBlock';

interface DeveloperToolsSectionProps {
  settings: AnchorSettings;
  updateSetting: <K extends keyof AnchorSettings>(
    key: K,
    value: AnchorSettings[K]
  ) => Promise<void> | void;
  resetSettings: () => Promise<void> | void;
  onResetOnboarding: () => Promise<void> | void;
}

const TIERS: Array<AnchorSettings['dev_simulatedTier']> = ['free', 'pro', 'trial', 'expired'];

export const DeveloperToolsSection: React.FC<DeveloperToolsSectionProps> = ({
  settings,
  updateSetting,
  resetSettings,
  onResetOnboarding,
}) => {
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

  return (
    <View>
      <Text style={styles.label}>⌥ Developer Tools</Text>
      <Text style={styles.description}>Build-only. Hidden in production.</Text>

      <SettingsSectionBlock isDev>
        <SettingsRow
          title="Developer Mode"
          type="toggle"
          toggleValue={settings.dev_developerModeEnabled}
          onToggle={(value) => updateSetting('dev_developerModeEnabled', value)}
          isDev
        />
        <SettingsRow
          title="Enable Dev Overrides"
          subtitle="Bypass paywalls & gate logic"
          type="toggle"
          toggleValue={settings.dev_overridesEnabled}
          onToggle={(value) => updateSetting('dev_overridesEnabled', value)}
          isDev
        />
        <View style={styles.segmentRow}>
          <Text style={styles.segmentTitle}>Simulated Subscription Tier</Text>
          <View style={styles.segmentedControl}>
            {TIERS.map((tier) => {
              const selected = settings.dev_simulatedTier === tier;
              return (
                <Pressable
                  key={tier}
                  onPress={() => updateSetting('dev_simulatedTier', tier)}
                  style={[
                    styles.segmentButton,
                    selected ? styles.segmentButtonSelected : null,
                  ]}
                >
                  <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                    {tier[0].toUpperCase() + tier.slice(1)}
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
          toggleValue={settings.dev_skipOnboarding}
          onToggle={(value) => updateSetting('dev_skipOnboarding', value)}
          isDev
        />
        <SettingsRow
          title="Allow Direct Anchor Delete"
          subtitle="Delete without full ritual"
          type="toggle"
          toggleValue={settings.dev_allowDirectAnchorDelete}
          onToggle={(value) => updateSetting('dev_allowDirectAnchorDelete', value)}
          isDev
        />
        <SettingsRow
          title="Debug Console Logging"
          subtitle="Verbose app logging"
          type="toggle"
          toggleValue={settings.dev_debugLogging}
          onToggle={(value) => updateSetting('dev_debugLogging', value)}
          isDev
        />
        <SettingsRow
          title="Force Streak Break"
          subtitle="Test streak protection UI"
          type="toggle"
          toggleValue={settings.dev_forceStreakBreak}
          onToggle={(value) => updateSetting('dev_forceStreakBreak', value)}
          isDev
          showDivider={false}
        />
      </SettingsSectionBlock>

      <Pressable onPress={handleReset} style={({ pressed }) => [styles.resetButton, pressed ? styles.resetButtonPressed : null]}>
        <View>
          <Text style={styles.resetText}>Reset Onboarding</Text>
          <Text style={styles.resetSubtext}>Restart from first launch state</Text>
        </View>
        <Text style={styles.resetChevron}>›</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    color: '#4ade80',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  description: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    color: '#4ade80',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
    opacity: 0.5,
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
