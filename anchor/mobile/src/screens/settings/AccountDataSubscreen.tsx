import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, settingsTypography } from '@/components/settings/settingsTheme';
import {
  CompactConfirmSheet,
  SectionLabel,
  SettingsHeader,
  SettingsRow,
} from '@/components/settings/SettingsPrimitives';
import { apiClient } from '@/services/ApiClient';
import { AuthService } from '@/services/AuthService';
import revenueCatService from '@/services/RevenueCatService';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

interface Props {
  onBack: () => void;
  onNavigateToLogin: () => void;
  onResetToOnboarding: () => void;
}

export const AccountDataSubscreen: React.FC<Props> = ({
  onBack,
  onNavigateToLogin,
  onResetToOnboarding,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Set password modal states
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [spEmail, setSpEmail] = useState('');
  const [spPassword, setSpPassword] = useState('');
  const [spConfirm, setSpConfirm] = useState('');
  const [spError, setSpError] = useState('');
  const [spLoading, setSpLoading] = useState(false);
  const [spShowPass, setSpShowPass] = useState(false);
  const [spShowConfirm, setSpShowConfirm] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const profileEmail = useAuthStore((s) => s.profileData?.user?.email?.trim() ?? '');
  const signOut = useAuthStore((s) => s.signOut);
  const setHasCompletedOnboarding = useAuthStore((s) => s.setHasCompletedOnboarding);

  const firebaseEmail = isAuthenticated ? AuthService.getCurrentFirebaseUser?.()?.email?.trim() ?? '' : '';
  const accountEmail = user?.email?.trim() || profileEmail || firebaseEmail;
  const canSetPassword = isAuthenticated && !AuthService.getLinkedProviders().includes('password');
  const showSignIn = !isAuthenticated || isGuest;

  const handleRestorePurchases = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const status = await revenueCatService.restorePurchases();
      Alert.alert(
        status.hasActiveEntitlement ? 'Purchases restored' : 'No subscription found',
        status.hasActiveEntitlement
          ? 'Your Pro access is active again.'
          : 'No active subscription was found for this account. If you subscribed with a different store account, switch to it and try again.',
      );
    } catch (error) {
      logger.warn('[AccountDataSubscreen] Restore purchases failed', error);
      Alert.alert('Restore failed', 'We could not restore purchases right now. Check your connection and try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportMyData = () => {
    if (isExporting) return;
    Alert.alert(
      'Export My Data',
      'Prepare a JSON export of your Anchors, sessions, settings, and account activity to share or save.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () => void (async () => {
            setIsExporting(true);
            try {
              const response = await apiClient.get<{ success: boolean; data?: unknown }>('/auth/me/export');
              if (!response.data?.success || !response.data.data) throw new Error('Failed to prepare export');
              await Share.share({ title: 'Anchor Data Export', message: JSON.stringify(response.data.data, null, 2) });
            } catch (error) {
              logger.warn('[AccountDataSubscreen] Failed to export user data', error);
              Alert.alert('Export Failed', 'Could not prepare your export. Please try again or contact support.');
            } finally {
              setIsExporting(false);
            }
          })(),
        },
      ]
    );
  };

  const handleSetPassword = async () => {
    if (spPassword.length < 6) {
      setSpError('Password must be at least 6 characters.');
      return;
    }
    if (spPassword !== spConfirm) {
      setSpError('Passwords do not match.');
      return;
    }
    setSpLoading(true);
    setSpError('');
    try {
      await AuthService.linkEmailPassword(spEmail, spPassword);
      setShowSetPasswordModal(false);
      Alert.alert('Password Set', 'You can now sign in with your email and password.');
    } catch (error) {
      setSpError(error instanceof Error ? error.message : 'Failed to set password.');
    } finally {
      setSpLoading(false);
    }
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
      logger.error('[AccountDataSubscreen] Failed to delete account', error);
      Alert.alert('Deletion Failed', error instanceof Error ? error.message : 'Failed to delete account.');
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <SettingsHeader title="Account & data" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel first>Account</SectionLabel>
          <SettingsRow
            label="Email address"
            value={accountEmail || 'Not signed in'}
            desc={isAuthenticated ? 'Synced to this account' : 'Not signed in'}
            chevron={false}
          />
          {canSetPassword ? (
            <SettingsRow
              label="Set Password"
              desc="Add email sign-in to your account."
              onPress={() => {
                setSpEmail(accountEmail || firebaseEmail);
                setSpPassword('');
                setSpConfirm('');
                setSpError('');
                setShowSetPasswordModal(true);
              }}
            />
          ) : null}
          {showSignIn ? (
            <SettingsRow
              label="Sign In"
              desc="Create or reconnect your account"
              onPress={onNavigateToLogin}
              testID="settings-row-Sign In"
            />
          ) : null}

          <SectionLabel>Purchases</SectionLabel>
          <SettingsRow
            label="Restore purchases"
            desc="Check store for existing Pro subscription"
            value={isRestoring ? 'Restoring…' : undefined}
            onPress={() => void handleRestorePurchases()}
            disabled={isRestoring}
            testID="settings-row-Restore Purchases"
          />

          <SectionLabel>Data</SectionLabel>
          <SettingsRow
            label="Export my data"
            desc="Create an export of your Anchor data."
            value={isExporting ? 'Preparing…' : undefined}
            onPress={handleExportMyData}
            disabled={isExporting}
          />

          {isAuthenticated ? (
            <View style={styles.dangerSection}>
              <SectionLabel>Danger Zone</SectionLabel>
              <SettingsRow
                label="Delete account"
                desc="Permanently remove your account and all data."
                titleColor={T.danger}
                onPress={() => setConfirmDelete(true)}
                showDivider={false}
              />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Delete Account Confirmation */}
      <CompactConfirmSheet
        open={confirmDelete}
        title="Delete account?"
        desc="This action is permanent and cannot be undone. All your Anchors and data will be deleted from our servers. Deleting your account will not cancel active subscriptions; cancel them through your App Store or Google Play account to prevent future billing."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDeleteAccount()}
        onClose={() => setConfirmDelete(false)}
      />

      {/* Set Password Modal */}
      <Modal
        visible={showSetPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSetPasswordModal(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setShowSetPasswordModal(false)}>
          <Pressable style={styles.passwordSheet} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.sheetHandle} />
              <Text style={styles.passwordSheetTitle}>Set Password</Text>
              <Text style={styles.passwordSubtitle}>Add a password so you can also sign in with your email.</Text>

              <TextInput
                style={styles.passwordInput}
                value={spEmail}
                onChangeText={setSpEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Email"
                placeholderTextColor={T.ink3}
              />
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={[styles.passwordInput, styles.passwordInputFlex]}
                  value={spPassword}
                  onChangeText={setSpPassword}
                  secureTextEntry={!spShowPass}
                  placeholder="New password"
                  placeholderTextColor={T.ink3}
                />
                <TouchableOpacity onPress={() => setSpShowPass((v) => !v)} style={styles.passwordEye}>
                  <Text style={styles.passwordEyeText}>{spShowPass ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={[styles.passwordInput, styles.passwordInputFlex]}
                  value={spConfirm}
                  onChangeText={setSpConfirm}
                  secureTextEntry={!spShowConfirm}
                  placeholder="Confirm password"
                  placeholderTextColor={T.ink3}
                />
                <TouchableOpacity onPress={() => setSpShowConfirm((v) => !v)} style={styles.passwordEye}>
                  <Text style={styles.passwordEyeText}>{spShowConfirm ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              {spError ? <Text style={styles.passwordError}>{spError}</Text> : null}

              <View style={styles.passwordActions}>
                <TouchableOpacity
                  onPress={() => setShowSetPasswordModal(false)}
                  style={styles.passwordCancelBtn}
                >
                  <Text style={styles.passwordCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={spLoading}
                  onPress={() => void handleSetPassword()}
                  style={[styles.passwordSubmitBtn, spLoading && styles.disabledButton]}
                >
                  <Text style={styles.passwordSubmitText}>{spLoading ? 'Setting…' : 'Set Password'}</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
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
  dangerSection: {
    marginTop: 8,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 23, 20, 0.4)',
    justifyContent: 'flex-end',
  },
  passwordSheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  passwordSheetTitle: {
    fontFamily: settingsTypography.displaySemiBold,
    fontSize: 20,
    color: T.ink,
    marginBottom: 6,
  },
  passwordSubtitle: {
    fontFamily: settingsTypography.body,
    fontSize: 14,
    color: T.ink2,
    lineHeight: 19,
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.line,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 14,
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 15,
    color: T.ink,
    marginBottom: 12,
  },
  passwordInputRow: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInputFlex: {
    marginBottom: 0,
    paddingRight: 60,
  },
  passwordEye: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  passwordEyeText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 13,
    color: T.ink2,
  },
  passwordError: {
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 13,
    color: T.danger,
    marginBottom: 10,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  passwordCancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordCancelText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 15,
    color: T.ink,
  },
  passwordSubmitBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: T.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordSubmitText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 15,
    color: T.surface,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
