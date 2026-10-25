import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import {
  GroupLabel,
  GroupRow,
  SettingsGroup,
  SettingsScreenFrame,
  StatusPill,
  SwitchRow,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { IconLock, IconShield } from '@/components/settings/SettingsIcons';
import { CompactConfirmSheet } from '@/components/settings/SettingsPrimitives';
import { settingsTypography } from '@/components/settings/settingsTheme';
import { apiClient } from '@/services/ApiClient';
import { AnalyticsService } from '@/services/AnalyticsService';
import { AuthService } from '@/services/AuthService';
import { formatLastBackup, useLastBackupAt } from '@/storage/backup/lastBackup';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { logger } from '@/utils/logger';

interface Props {
  onBack: () => void;
  onOpenBackup: () => void;
  onResetToOnboarding: () => void;
}

export const DataPrivacySubscreen: React.FC<Props> = ({ onBack, onOpenBackup, onResetToOnboarding }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);
  const setHasCompletedOnboarding = useAuthStore((s) => s.setHasCompletedOnboarding);
  const analyticsEnabled = useSettingsStore((s) => s.analyticsEnabled);
  const setAnalyticsEnabled = useSettingsStore((s) => s.setAnalyticsEnabled);
  const lastBackupAt = useLastBackupAt();

  const handleAnalyticsToggle = (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    const effective = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false' && enabled;
    AnalyticsService.setEnabled(effective);
    if (effective) {
      AnalyticsService.track('analytics_opted_in', { source: 'settings_privacy' });
    }
  };

  const handleExportMyData = () => {
    if (isExporting) return;
    Alert.alert(
      'Export my data',
      'Prepare a JSON export of your Anchors, sessions, settings, and account activity to share or save.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () =>
            void (async () => {
              setIsExporting(true);
              try {
                const response = await apiClient.get<{ success: boolean; data?: unknown }>('/auth/me/export');
                if (!response.data?.success || !response.data.data) throw new Error('Failed to prepare export');
                await Share.share({
                  title: 'Anchor Data Export',
                  message: JSON.stringify(response.data.data, null, 2),
                });
              } catch (error) {
                logger.warn('[DataPrivacySubscreen] Failed to export user data', error);
                Alert.alert('Export failed', 'Could not prepare your export. Please try again or contact support.');
              } finally {
                setIsExporting(false);
              }
            })(),
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setConfirmDelete(false);
    try {
      await AuthService.deleteAccount();
      const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
      await writeSecureValue('anchor-sync-retry-queue', '[]');
      await signOut();
      setHasCompletedOnboarding(false);
      onResetToOnboarding();
    } catch (error) {
      logger.error('[DataPrivacySubscreen] Failed to delete account', error);
      Alert.alert('Deletion failed', error instanceof Error ? error.message : 'Failed to delete account.');
    }
  };

  return (
    <SettingsScreenFrame title="Data & privacy" onBack={onBack} testID="data-privacy-screen">
      <View style={styles.banner}>
        <IconShield size={22} color={cardTheme.gold} />
        <Text style={styles.bannerText}>
          Your Anchors, practice progress and drafts are stored locally on this device.
        </Text>
      </View>

      <GroupLabel>Your data</GroupLabel>
      <SettingsGroup>
        <GroupRow
          icon={<IconLock size={20} color={cardTheme.gold} />}
          title="Backup & recovery"
          subtitle={lastBackupAt ? `Last backup ${formatLastBackup(lastBackupAt)}` : 'Never backed up'}
          badge={lastBackupAt ? undefined : <StatusPill label="Set up" />}
          onPress={onOpenBackup}
          testID="settings-row-Backup & recovery"
        />
        <GroupRow
          title="Export my data"
          subtitle={isExporting ? 'Preparing…' : 'Create a copy of your Anchor data'}
          onPress={handleExportMyData}
          disabled={isExporting}
          testID="settings-row-Export my data"
        />
      </SettingsGroup>

      <GroupLabel>Privacy</GroupLabel>
      <SettingsGroup>
        <SwitchRow
          title="Share anonymous analytics"
          subtitle="Anonymous usage data helps us improve Anchor."
          on={analyticsEnabled}
          onChange={handleAnalyticsToggle}
          testID="settings-row-Share anonymous analytics"
        />
      </SettingsGroup>

      {isAuthenticated ? (
        <>
          <GroupLabel>Danger zone</GroupLabel>
          <SettingsGroup>
            <GroupRow
              title="Delete account"
              subtitle="Permanently remove your account and all data"
              destructive
              onPress={() => setConfirmDelete(true)}
              testID="settings-row-Delete account"
            />
          </SettingsGroup>
        </>
      ) : null}

      <CompactConfirmSheet
        open={confirmDelete}
        title="Delete account?"
        desc="This action is permanent and cannot be undone. All your Anchors and data will be deleted from our servers. Deleting your account will not cancel active subscriptions; cancel them through your App Store or Google Play account to prevent future billing."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDeleteAccount()}
        onClose={() => setConfirmDelete(false)}
      />
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: cardTheme.goldTint,
    borderRadius: 18,
  },
  bannerText: {
    flex: 1,
    fontFamily: settingsTypography.body,
    fontSize: 15,
    lineHeight: 22,
    color: cardTheme.ink,
  },
});
