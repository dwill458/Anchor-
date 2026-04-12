import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';

type NavigationProp = StackNavigationProp<RootStackParamList, 'FirstAnchorAccountGate'>;

export const FirstAnchorAccountGateScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const isFinalizingPendingFirstAnchor = useAuthStore(
    (state) => state.isFinalizingPendingFirstAnchor
  );
  const pendingFirstAnchorError = useAuthStore((state) => state.pendingFirstAnchorError);
  const finalizePendingFirstAnchorDraft = useAuthStore(
    (state) => state.finalizePendingFirstAnchorDraft
  );
  const clearPendingFirstAnchorError = useAuthStore((state) => state.clearPendingFirstAnchorError);
  const signOut = useAuthStore((state) => state.signOut);

  React.useEffect(() => {
    if (!pendingFirstAnchorDraft) {
      navigation.replace('Vault');
      return;
    }

    if (!isAuthenticated || isFinalizingPendingFirstAnchor || pendingFirstAnchorError) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const didFinalize = await finalizePendingFirstAnchorDraft();
      if (!cancelled && didFinalize) {
        navigation.replace('Vault');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    finalizePendingFirstAnchorDraft,
    isAuthenticated,
    isFinalizingPendingFirstAnchor,
    navigation,
    pendingFirstAnchorDraft,
    pendingFirstAnchorError,
  ]);

  const handleCreateAccount = React.useCallback(() => {
    clearPendingFirstAnchorError();
    navigation.navigate('SignUp', { context: 'first_anchor_gate' });
  }, [clearPendingFirstAnchorError, navigation]);

  const handleSignIn = React.useCallback(() => {
    clearPendingFirstAnchorError();
    navigation.navigate('Login', { context: 'first_anchor_gate' });
  }, [clearPendingFirstAnchorError, navigation]);

  const handleRetry = React.useCallback(async () => {
    clearPendingFirstAnchorError();
    const didFinalize = await finalizePendingFirstAnchorDraft();
    if (didFinalize) {
      navigation.replace('Vault');
    }
  }, [clearPendingFirstAnchorError, finalizePendingFirstAnchorDraft, navigation]);

  const handleSwitchAccount = React.useCallback(async () => {
    clearPendingFirstAnchorError();
    await AuthService.signOut().catch(() => undefined);
    signOut();
  }, [clearPendingFirstAnchorError, signOut]);

  const showAuthenticatedState = isAuthenticated;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.navy, '#171219', colors.charcoal]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>FIRST VAULT ENTRY</Text>
          <Text style={styles.title}>Create an account to keep this anchor.</Text>
          <Text style={styles.body}>
            Your first anchor is ready. We need an account before it can enter your Vault so it
            stays attached to you and syncs correctly.
          </Text>

          <View style={styles.card}>
            {showAuthenticatedState ? (
              <>
                <Text style={styles.cardTitle}>
                  {isFinalizingPendingFirstAnchor ? 'Saving your first anchor' : 'Almost there'}
                </Text>
                <Text style={styles.cardBody}>
                  {isFinalizingPendingFirstAnchor
                    ? 'We are attaching your first anchor to this account and replaying your ritual progress.'
                    : pendingFirstAnchorError ||
                      'You are signed in. Finish syncing your first anchor to continue into the Vault.'}
                </Text>

                {isFinalizingPendingFirstAnchor ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.gold} />
                    <Text style={styles.loadingText}>Finalizing account handoff...</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleRetry}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[colors.gold, '#B8941F']}
                        style={styles.primaryGradient}
                      >
                        <Text style={styles.primaryText}>Finish Saving My Anchor</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={handleSwitchAccount}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.secondaryText}>Use a different account</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Account required</Text>
                <Text style={styles.cardBody}>
                  Sign up or sign in to save this first anchor before entering the Vault.
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleCreateAccount}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.gold, '#B8941F']}
                    style={styles.primaryGradient}
                  >
                    <Text style={styles.primaryText}>Create Account</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleSignIn}
                  activeOpacity={0.75}
                >
                  <Text style={styles.secondaryText}>I already have an account</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  eyebrow: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 2.8,
    color: colors.gold,
    opacity: 0.78,
  },
  title: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 30,
    lineHeight: 38,
    color: colors.bone,
  },
  body: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 18,
    lineHeight: 28,
    color: colors.silver,
    opacity: 0.9,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    backgroundColor: 'rgba(15, 20, 25, 0.82)',
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 20,
    lineHeight: 28,
    color: colors.bone,
  },
  cardBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: colors.text.secondary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.text.secondary,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  primaryGradient: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 1.6,
    color: colors.navy,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: colors.gold,
  },
});
