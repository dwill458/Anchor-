import React, { useState } from 'react';
import { Alert, DeviceEventEmitter, Linking, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  GroupLabel,
  GroupRow,
  SettingsGroup,
  SettingsScreenFrame,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { CompactConfirmSheet } from '@/components/settings/SettingsPrimitives';
import { settingsTypography } from '@/components/settings/settingsTheme';
import { useToast } from '@/components/ToastProvider';
import { LEGAL_URLS, SUPPORT_EMAIL_URL } from '@/constants/legal';
import { TEACHING_COPY } from '@/constants/v2/teachingCopy';
import { resetChartTaughtState } from '@/hooks/v2/chart/chartTaughtState';
import { resetAllTeachingSeen } from '@/hooks/v2/teaching/teachingSeen';
import { AnalyticsService } from '@/services/AnalyticsService';
import { openStoreListing } from '@/services/reviewPromptService';
import { useAuthStore } from '@/stores/authStore';
import { useTeachingStore } from '@/stores/teachingStore';

interface Props {
  onBack: () => void;
}

export const HelpAboutSubscreen: React.FC<Props> = ({ onBack }) => {
  const toast = useToast();
  const teachingAccountId = useAuthStore((s) => s.user?.id ?? null);
  const [confirmReplay, setConfirmReplay] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '2.0.0';

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
      // fall through to the web support page
    }
    await openUrl(LEGAL_URLS.support);
  };

  const handleReplayTips = async () => {
    useTeachingStore.getState().resetTeachingRecords();
    const resetSeen = resetAllTeachingSeen(teachingAccountId);
    const resetChart = resetChartTaughtState(teachingAccountId);
    const clearPractice = Promise.resolve(
      AsyncStorage.removeItem('practice_teaching_auto_seen_v2')
    ).catch(() => undefined);
    DeviceEventEmitter.emit('replayAppTeaching');
    DeviceEventEmitter.emit('chartReplayOneMoveTeaching');
    AnalyticsService.track('teaching_reset');
    toast.info(TEACHING_COPY.replay.confirmation);
    await Promise.all([resetSeen, resetChart, clearPractice]);
  };

  return (
    <SettingsScreenFrame title="Help & about" onBack={onBack} testID="help-about-screen">
      <GroupLabel first>Get help</GroupLabel>
      <SettingsGroup>
        <GroupRow
          title="Contact support"
          subtitle="Email our team"
          onPress={() => void handleSupport()}
          testID="settings-row-Contact support"
        />
        <GroupRow
          title="Replay app tips"
          subtitle="Show the quick tips on every screen again"
          onPress={() => setConfirmReplay(true)}
          testID="settings-row-Replay app tips"
        />
      </SettingsGroup>

      <GroupLabel>Enjoying Anchor?</GroupLabel>
      <SettingsGroup>
        <GroupRow
          title="Rate Anchor"
          subtitle="Leave a review on the app store"
          chevron="external"
          onPress={() => void openStoreListing()}
          testID="settings-row-Rate Anchor"
        />
      </SettingsGroup>

      <GroupLabel>Legal</GroupLabel>
      <SettingsGroup>
        <GroupRow
          title="Privacy policy"
          chevron="external"
          onPress={() => void openUrl(LEGAL_URLS.privacyPolicy)}
          testID="settings-row-Privacy policy"
        />
        <GroupRow
          title="Terms of service"
          chevron="external"
          onPress={() => void openUrl(LEGAL_URLS.termsOfService)}
          testID="settings-row-Terms of service"
        />
      </SettingsGroup>

      <Text style={styles.version}>{`Anchor ${appVersion}`}</Text>

      <CompactConfirmSheet
        open={confirmReplay}
        title="Replay app tips?"
        desc="The quick tips will show again the next time you visit each screen."
        confirmLabel="Replay"
        onConfirm={() => void handleReplayTips()}
        onClose={() => setConfirmReplay(false)}
      />
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  version: {
    textAlign: 'center',
    marginTop: 32,
    fontFamily: settingsTypography.body,
    fontSize: 13,
    color: cardTheme.muted,
  },
});
