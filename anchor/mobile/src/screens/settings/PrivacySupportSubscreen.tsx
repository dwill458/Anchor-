import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '@/components/settings/settingsTheme';
import {
  SectionLabel,
  SettingsHeader,
  SettingsRow,
  SettingsToggleRow,
} from '@/components/settings/SettingsPrimitives';
import { LEGAL_URLS, SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '@/constants/legal';
import { AnalyticsService } from '@/services/AnalyticsService';
import { openStoreListing } from '@/services/reviewPromptService';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  onBack: () => void;
}

export const PrivacySupportSubscreen: React.FC<Props> = ({ onBack }) => {
  const analyticsEnabled = useSettingsStore((s) => s.analyticsEnabled);
  const setAnalyticsEnabled = useSettingsStore((s) => s.setAnalyticsEnabled);

  const openUrl = async (url: string) => {
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error('Unsupported URL');
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link unavailable', 'This link could not be opened right now.');
    }
  };

  const handleSupport = async () => {
    try {
      if (await Linking.canOpenURL(SUPPORT_EMAIL_URL)) {
        await Linking.openURL(SUPPORT_EMAIL_URL);
        return;
      }
    } catch {
      // Fallback
    }
    await openUrl(LEGAL_URLS.support);
  };

  const handleAnalyticsToggle = (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    const effective = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false' && enabled;
    AnalyticsService.setEnabled(effective);
    if (effective) {
      AnalyticsService.track('analytics_opted_in', { source: 'settings_privacy' });
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <SettingsHeader title="Privacy & support" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel first>Privacy</SectionLabel>
          <SettingsToggleRow
            label="Analytics"
            desc="Share anonymous usage data to help us improve Anchor."
            on={analyticsEnabled}
            onToggle={handleAnalyticsToggle}
          />

          <SectionLabel>Support</SectionLabel>
          <SettingsRow
            label="Help & support"
            value={SUPPORT_EMAIL}
            onPress={() => void handleSupport()}
          />
          <SettingsRow
            label="Rate Anchor"
            desc="Leave a review on the app store"
            onPress={() => void openStoreListing()}
          />

          <SectionLabel>Legal</SectionLabel>
          <SettingsRow
            label="Privacy policy"
            onPress={() => void openUrl(LEGAL_URLS.privacyPolicy)}
          />
          <SettingsRow
            label="Terms of service"
            onPress={() => void openUrl(LEGAL_URLS.termsOfService)}
            showDivider={false}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
});
