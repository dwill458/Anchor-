import React from 'react';
import {
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
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

type AuthGateNavigationProp = StackNavigationProp<RootStackParamList, 'AuthGate'>;

export default function AuthGateScreen() {
  const navigation = useNavigation<AuthGateNavigationProp>();
  const clearPendingForgeIntent = useAuthStore((state) => state.clearPendingForgeIntent);
  const clearPendingForgeResumeTarget = useAuthStore((state) => state.clearPendingForgeResumeTarget);

  const handleDismiss = () => {
    clearPendingForgeIntent();
    clearPendingForgeResumeTarget();
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ZenBackground variant="creation" showOrbs showGrain showVignette />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            activeOpacity={0.8}
            onPress={handleDismiss}
          >
            <Text style={styles.backText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.kicker}>AUTH REQUIRED</Text>
          <Text style={styles.title}>Your anchor is ready to forge.</Text>
          <Text style={styles.subtitle}>
            Create a free account to continue — no credit card required.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('SignUp')}
          >
            <LinearGradient
              colors={[colors.gold, '#B8941F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>Start 7-Day Free Trial</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryText}>Already have an account? Sign in</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing.xxl,
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
