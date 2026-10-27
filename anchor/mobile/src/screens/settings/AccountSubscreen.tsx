import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, settingsTypography } from '@/components/settings/settingsTheme';
import {
  ActionButton,
  GroupLabel,
  GroupRow,
  SettingsGroup,
  SettingsScreenFrame,
  TierPill,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { CompactConfirmSheet } from '@/components/settings/SettingsPrimitives';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { AuthService } from '@/services/AuthService';
import { forceEntranceAfterSignOut } from '@/services/forceEntranceAfterSignOut';
import revenueCatService from '@/services/RevenueCatService';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { logger } from '@/utils/logger';

interface Props {
  onBack: () => void;
  onNavigateToLogin: () => void;
  onOpenPaywall: () => void;
  onSignedOut?: () => void;
}

const MANAGE_SUBSCRIPTION_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

export const AccountSubscreen: React.FC<Props> = ({
  onBack,
  onNavigateToLogin,
  onOpenPaywall,
  onSignedOut,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

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
  const memberSince = useProfileStore((s) => s.memberSince);
  const { isSubscribed, isTrialActive, daysRemaining } = useTrialStatus();

  const firebaseEmail = isAuthenticated ? AuthService.getCurrentFirebaseUser?.()?.email?.trim() ?? '' : '';
  const accountEmail = user?.email?.trim() || profileEmail || firebaseEmail;
  const canSetPassword = isAuthenticated && !AuthService.getLinkedProviders().includes('password');
  const showSignIn = !isAuthenticated || isGuest;

  const memberSinceDate = memberSince ? new Date(memberSince) : user?.createdAt ? new Date(user.createdAt) : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : null;

  const planName = isSubscribed ? 'Anchor Pro' : isTrialActive ? 'Anchor Pro trial' : 'Anchor Free';
  const tierBadge = isSubscribed ? 'PRO' : isTrialActive ? 'TRIAL' : 'FREE';
  const statusLine = [
    isSubscribed
      ? 'Active'
      : isTrialActive
        ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
        : 'Not subscribed',
    memberSinceLabel ? `Member since ${memberSinceLabel}` : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');

  const handleManageSubscription = async () => {
    try {
      await Linking.openURL(MANAGE_SUBSCRIPTION_URL);
    } catch (error) {
      logger.warn('[AccountSubscreen] Could not open subscription management', error);
      Alert.alert('Link unavailable', 'Manage your subscription from your App Store or Google Play account.');
    }
  };

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
      logger.warn('[AccountSubscreen] Restore purchases failed', error);
      Alert.alert('Restore failed', 'We could not restore purchases right now. Check your connection and try again.');
    } finally {
      setIsRestoring(false);
    }
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
      Alert.alert('Password set', 'You can now sign in with your email and password.');
    } catch (error) {
      setSpError(error instanceof Error ? error.message : 'Failed to set password.');
    } finally {
      setSpLoading(false);
    }
  };

  const confirmSignOut = async () => {
    setConfirmSignOutOpen(false);
    try {
      AnalyticsService.track(AnalyticsEvents.SIGN_OUT, { source: 'settings' });
      await AuthService.signOut();
      const { writeSecureValue } = require('@/stores/encryptedPersistStorage');
      await writeSecureValue('anchor-sync-retry-queue', '[]');
      await signOut();
      setHasCompletedOnboarding(false);
      forceEntranceAfterSignOut();
      onSignedOut?.();
    } catch (error) {
      logger.warn('[AccountSubscreen] Failed to sign out cleanly', error);
      Alert.alert('Sign out failed', 'We could not sign you out right now.');
    }
  };

  return (
    <SettingsScreenFrame title="Account & subscription" onBack={onBack} testID="account-screen">
      <View style={styles.planCard}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planName}>{planName}</Text>
          <TierPill label={tierBadge} />
        </View>
        <Text style={styles.planStatus}>{statusLine}</Text>
        {isSubscribed ? (
          <ActionButton
            label="Manage subscription"
            onPress={() => void handleManageSubscription()}
            testID="account-manage-subscription"
          />
        ) : (
          <ActionButton label="See Anchor Pro" onPress={onOpenPaywall} testID="account-open-paywall" />
        )}
      </View>

      <GroupLabel>Account</GroupLabel>
      <SettingsGroup>
        <View style={styles.emailRow} testID="settings-row-Email">
          <Text style={styles.emailLabel}>Email</Text>
          <Text style={styles.emailValue} selectable>
            {accountEmail || 'Not signed in'}
          </Text>
          <Text style={styles.emailLabel}>
            {isAuthenticated ? 'Linked to your account' : 'Sign in to link your account'}
          </Text>
        </View>
        {canSetPassword ? (
          <GroupRow
            title="Set password"
            subtitle="Add email sign-in to your account"
            onPress={() => {
              setSpEmail(accountEmail || firebaseEmail);
              setSpPassword('');
              setSpConfirm('');
              setSpError('');
              setShowSetPasswordModal(true);
            }}
            testID="settings-row-Set password"
          />
        ) : null}
        <GroupRow
          title="Restore purchases"
          subtitle={isRestoring ? 'Restoring\u2026' : 'Already subscribed? Check the store for your Pro plan.'}
          disabled={isRestoring}
          onPress={() => void handleRestorePurchases()}
          testID="settings-row-Restore Purchases"
        />
        {showSignIn ? (
          <GroupRow
            title="Sign in"
            subtitle="Create or reconnect your account"
            onPress={onNavigateToLogin}
            testID="settings-row-Sign In"
          />
        ) : (
          <GroupRow
            title="Sign out"
            chevron="none"
            onPress={() => setConfirmSignOutOpen(true)}
            testID="settings-row-Sign Out"
          />
        )}
      </SettingsGroup>

      <CompactConfirmSheet
        open={confirmSignOutOpen}
        title="Sign out of Anchor?"
        desc="You can sign back in at any time to continue your practice."
        confirmLabel="Sign out"
        onConfirm={() => void confirmSignOut()}
        onClose={() => setConfirmSignOutOpen(false)}
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
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  planCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    gap: 14,
    backgroundColor: cardTheme.card,
    borderWidth: 1,
    borderColor: cardTheme.cardBorder,
    borderRadius: 18,
  },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontFamily: settingsTypography.bodyBold, fontSize: 20, color: cardTheme.ink },
  planStatus: { fontFamily: settingsTypography.body, fontSize: 14, color: cardTheme.muted },
  emailRow: { paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  emailLabel: { fontFamily: settingsTypography.body, fontSize: 14, color: cardTheme.muted },
  emailValue: { fontFamily: settingsTypography.bodySemiBold, fontSize: 16, color: cardTheme.ink },
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
