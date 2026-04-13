import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ZenBackground } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import RevenueCatService from '@/services/RevenueCatService';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type PaywallNavigationProp = StackNavigationProp<RootStackParamList, 'Paywall'>;

export default function PaywallScreen() {
  const navigation = useNavigation<PaywallNavigationProp>();
  const { hasActiveEntitlement } = useTrialStatus();
  const clearPendingForgeIntent = useAuthStore((state) => state.clearPendingForgeIntent);
  const clearPendingForgeResumeTarget = useAuthStore((state) => state.clearPendingForgeResumeTarget);
  const pendingForgeResumeTarget = useAuthStore((state) => state.pendingForgeResumeTarget);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleDismiss = () => {
    clearPendingForgeIntent();
    clearPendingForgeResumeTarget();
    navigation.goBack();
  };

  const handleContinue = async () => {
    setIsLoading(true);
    setErrorText(null);

    try {
      const result = await RevenueCatService.purchaseDefaultTrialPackage();
      const status = result.status.hasActiveEntitlement
        ? result.status
        : await RevenueCatService.refreshTrialStatus();

      if (status.hasActiveEntitlement && pendingForgeResumeTarget === 'CreateAnchor') {
        clearPendingForgeResumeTarget();
        navigation.replace('CreateAnchor');
        return;
      }

      if (status.hasActiveEntitlement) {
        navigation.goBack();
        return;
      }

      setErrorText('We could not verify active access yet. Please try again or restore purchases.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to continue your practice right now.';
      setErrorText(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    setErrorText(null);

    try {
      const status = await RevenueCatService.restorePurchases();
      if (status.hasActiveEntitlement && pendingForgeResumeTarget === 'CreateAnchor') {
        clearPendingForgeResumeTarget();
        navigation.replace('CreateAnchor');
        return;
      }

      if (status.hasActiveEntitlement) {
        navigation.goBack();
        return;
      }

      setErrorText('No active access was found to restore.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed.';
      setErrorText(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ZenBackground variant="creation" showOrbs showGrain showVignette />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleDismiss}>
            <Text style={styles.backText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.kicker}>
            {hasActiveEntitlement ? 'ACCESS ACTIVE' : 'ACCESS REQUIRED'}
          </Text>
          <Text style={styles.title}>Continue Your Practice</Text>
          <Text style={styles.subtitle}>
            Your 7-day trial has ended. Keep forging.
          </Text>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.88}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[colors.gold, '#B8941F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.navy} />
              ) : (
                <Text style={styles.primaryText}>Continue Your Practice</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={handleRestore}
            disabled={isLoading}
          >
            <Text style={styles.secondaryText}>Restore Purchase</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  headerRow: {
    paddingTop: spacing.md,
    alignItems: 'flex-end',
  },
  backText: {
    color: colors.silver,
    fontSize: 15,
    fontFamily: typography.fonts.body,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  kicker: {
    color: colors.gold,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.bone,
    fontSize: 34,
    lineHeight: 44,
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
    marginBottom: spacing.lg,
  },
  subtitle: {
    color: colors.bone,
    opacity: 0.82,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  primaryGradient: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryText: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryText: {
    color: colors.bone,
    fontSize: 15,
  },
});
