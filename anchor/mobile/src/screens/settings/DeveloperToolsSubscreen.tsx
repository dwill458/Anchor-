import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, settingsTypography } from '@/components/settings/settingsTheme';
import { SettingsHeader } from '@/components/settings/SettingsPrimitives';
import { DeveloperToolsSection } from '@/components/settings/DeveloperToolsSection';

interface Props {
  onBack: () => void;
  onResetOnboarding: () => void;
}

export const DeveloperToolsSubscreen: React.FC<Props> = ({
  onBack,
  onResetOnboarding,
}) => {
  // STRICT BUILD GATE
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <SettingsHeader title="Developer Tools" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.devBanner}>
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>DEV ONLY</Text>
            </View>
            <Text style={styles.devBannerTitle}>Internal Testing Controls</Text>
            <Text style={styles.devBannerDesc}>
              These controls simulate Anchor 2.0 runtime states, reset local caches, test notification
              triggers, and override performance tiers. These controls do not appear in release builds.
            </Text>
          </View>

          <DeveloperToolsSection onResetOnboarding={onResetOnboarding} />
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
  devBanner: {
    backgroundColor: T.devGreenBg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.devGreenBorder,
    padding: 16,
    marginBottom: 20,
    marginTop: 8,
  },
  devBadge: {
    alignSelf: 'flex-start',
    backgroundColor: T.devGreen,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 8,
  },
  devBadgeText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  devBannerTitle: {
    fontFamily: settingsTypography.displaySemiBold,
    fontSize: 16,
    color: T.devGreen,
    marginBottom: 4,
  },
  devBannerDesc: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: '#3B6047',
    lineHeight: 17,
  },
});
