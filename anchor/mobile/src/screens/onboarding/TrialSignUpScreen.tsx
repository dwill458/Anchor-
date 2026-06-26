/**
 * TrialSignUpScreen — Account creation gate between first prime and Sanctuary.
 *
 * Flow: FirstPrimeCompleteScreen (tap) → here → Vault (Sanctuary)
 *
 * Exits:
 *  1. Create account + start free trial — signs up, launches RevenueCat,
 *     then navigates to Vault
 *  2. Sign In                           — navigates to Login
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList, TrialSignUpSource } from '@/types';
import { colors, typography } from '@/theme';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';
import RevenueCatService from '@/services/RevenueCatService';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';

type TrialNavProp = StackNavigationProp<RootStackParamList, 'TrialSignUp'>;
type TrialRouteProp = RouteProp<RootStackParamList, 'TrialSignUp'>;

const SCREEN_COPY: Record<
  TrialSignUpSource,
  {
    benefits: Array<{ icon: string; label: string }>;
    headline: string;
    subheadline: string;
    cta: string;
  }
> = {
  save_progress: {
    benefits: [
      { icon: '☁', label: 'Save this anchor to your Sanctuary' },
      { icon: '◎', label: 'Enter Sanctuary with your full practice history' },
      { icon: '✦', label: 'Unlock AI enhancement and premium rituals' },
      { icon: '⚡', label: 'Sync seamlessly across devices' },
    ],
    headline: `Save your anchor.\nEnter Sanctuary.`,
    subheadline:
      'Create your account and start your free trial to save this anchor, unlock Sanctuary, and keep your practice synced across devices.\nNo payment today. Cancel before renewal if you do not want to continue.',
    cta: 'CREATE ACCOUNT & START TRIAL',
  },
  legacy_guest: {
    benefits: [
      { icon: '☁', label: 'Save your existing Sanctuary to your account' },
      { icon: '◎', label: 'Keep your anchors and practice history together' },
      { icon: '✦', label: 'Unlock new anchor creation and premium rituals' },
      { icon: '⚡', label: 'Sync your Sanctuary seamlessly across devices' },
    ],
    headline: `Save your Sanctuary.\nKeep every anchor.`,
    subheadline:
      'Accounts are now required for Sanctuary going forward. Create your account and start your free trial to keep these anchors, continue your practice, and sync everything across devices.\nNo payment today. Cancel before renewal if you do not want to continue.',
    cta: 'SAVE SANCTUARY & START TRIAL',
  },
};

const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized.split('').map((c) => `${c}${c}`).join('')
      : normalized;
  const val = parseInt(expanded, 16);
  return `rgba(${(val >> 16) & 255},${(val >> 8) & 255},${val & 255},${alpha})`;
};

export const TrialSignUpScreen: React.FC = () => {
  const navigation = useNavigation<TrialNavProp>();
  const route = useRoute<TrialRouteProp>();
  const source = route.params?.source ?? 'save_progress';
  const copy = SCREEN_COPY[source];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  // Once the account exists, the user is committed to starting the trial — a
  // dismissed store sheet must be retried (purchase only, not a re-signup).
  const [accountReady, setAccountReady] = useState(false);

  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, glowAnim]);

  const proceedToVault = useCallback(() => {
    navigateToVaultDestination(navigation, 'replace');
  }, [navigation]);

  /**
   * Re-attempt only the store trial purchase (the account already exists).
   * Used when the user dismissed the native store sheet and must retry.
   *  - entitlement granted  → continue to Vault
   *  - dismissed again       → stay blocked with a prompt
   *  - billing threw         → don't trap the user; fall through to Vault
   */
  const retryTrialPurchase = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const { status, dismissed } = await RevenueCatService.purchaseDefaultTrialPackage();
      if (status.hasActiveEntitlement) {
        proceedToVault();
        return;
      }
      if (dismissed) {
        setError('Start your free trial to continue.');
      } else {
        proceedToVault();
      }
    } catch {
      // Billing unavailable/misconfigured — never strand the user on retry.
      proceedToVault();
    } finally {
      setLoading(false);
    }
  }, [proceedToVault]);

  const handleSignUp = async () => {
    // Account already created on a previous tap: only retry the store trial.
    if (accountReady) {
      await retryTrialPurchase();
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await AuthService.signUpWithEmail(email.trim(), password, '', {
        hasCompletedOnboarding: true,
      });
      const postAuth = await PostAuthFlowService.run({
        user: result.user,
        token: result.token,
        preserveCompletedOnboarding: true,
        // Start a real store free-trial so RevenueCat tracks the trial and
        // auto-converts it to a paid subscription.
        launchTrialPurchase: true,
      });

      if (postAuth.hasActiveEntitlement) {
        proceedToVault();
        return;
      }

      // The account now exists. If the user backed out of the store sheet,
      // block here and require a retry. If billing was simply unavailable
      // (misconfigured / offline), let them through on the fallback trial so
      // onboarding can never brick.
      if (postAuth.trialOutcome === 'dismissed') {
        setAccountReady(true);
        setError('Start your free trial to continue.');
      } else {
        proceedToVault();
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] });

  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient purple bleed */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="60%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="trial-ambient-bg" cx="50%" cy="20%" r="70%">
              <Stop offset="0%" stopColor={colors.deepPurple} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={colors.deepPurple} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#trial-ambient-bg)" />
        </Svg>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Sign-in link — hidden once the account exists (trial is required) */}
            {!accountReady && (
              <TouchableOpacity
                style={styles.signInBtn}
                onPress={() => navigation.navigate('Login')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.signInText}>Sign In</Text>
              </TouchableOpacity>
            )}

            {/* Hero */}
            <View style={styles.hero}>
              <Animated.View
                pointerEvents="none"
                style={[styles.glowOrb, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
              />

              {/* Corner accents */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>7-DAY FREE TRIAL</Text>
              </View>

              <Text style={styles.headline}>{copy.headline}</Text>
              <Text style={styles.subheadline}>{copy.subheadline}</Text>
            </View>

            {/* Benefits list */}
            <View style={styles.benefits}>
              {copy.benefits.map((b) => (
                <View key={b.label} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{b.icon}</Text>
                  <Text style={styles.benefitLabel}>{b.label}</Text>
                </View>
              ))}
            </View>

            {/* Divider ornament */}
            <View style={styles.ornament}>
              <View style={styles.ornamentLine} />
              <View style={styles.ornamentDiamond} />
              <View style={styles.ornamentLine} />
            </View>

            {/* Form card — collapses once the account exists; the screen then
                becomes a mandatory "start your free trial" wall. */}
            <View style={[styles.card, accountReady && styles.cardHidden]}
              pointerEvents={accountReady ? 'none' : 'auto'}
            >
              {Platform.OS === 'ios' ? (
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.navy, 0.92) }]} />
              )}
              <View style={styles.cardInner}>
                <TextInput
                  style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.silver}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
                <TextInput
                  style={[styles.input, focusedField === 'password' && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (8+ characters)"
                  placeholderTextColor={colors.silver}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSignUp}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            </View>

            {/* Primary CTA */}
            <TouchableOpacity
              style={[styles.ctaBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.navy} />
              ) : (
                <Text style={styles.ctaText}>
                  {accountReady ? 'START FREE TRIAL' : copy.cta}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.legalText}>
              No payment required today. Pricing and renewal terms are shown in the store sheet before purchase.
            </Text>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 48,
  },

  signInBtn: {
    position: 'absolute',
    top: -8,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.45),
    backgroundColor: withAlpha(colors.gold, 0.07),
  },
  signInText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.gold,
  },

  hero: {
    alignItems: 'center',
    paddingTop: 44,
    paddingBottom: 28,
    paddingHorizontal: 8,
  },
  glowOrb: {
    position: 'absolute',
    top: 0,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.deepPurple,
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    opacity: 0.35,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.gold,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.gold,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.gold,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.gold,
  },
  trialBadge: {
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.55),
    backgroundColor: withAlpha(colors.gold, 0.1),
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 22,
  },
  trialBadgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 2.8,
    color: colors.gold,
  },
  headline: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 34,
    color: colors.bone,
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  subheadline: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 15,
    color: colors.silver,
    textAlign: 'center',
    lineHeight: 23,
  },

  benefits: {
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIcon: {
    fontSize: 16,
    width: 26,
    textAlign: 'center',
    color: colors.gold,
    fontFamily: typography.fonts.heading,
  },
  benefitLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 15,
    color: colors.bone,
    flex: 1,
  },

  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  ornamentLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(colors.gold, 0.25),
  },
  ornamentDiamond: {
    width: 5,
    height: 5,
    backgroundColor: colors.gold,
    opacity: 0.55,
    transform: [{ rotate: '45deg' }],
  },

  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.18),
    marginBottom: 14,
  },
  cardHidden: {
    height: 0,
    marginBottom: 0,
    borderWidth: 0,
    opacity: 0,
  },
  cardInner: {
    padding: 14,
    gap: 10,
  },
  input: {
    height: 52,
    backgroundColor: withAlpha(colors.navy, 0.7),
    borderRadius: 10,
    paddingHorizontal: 16,
    color: colors.bone,
    borderWidth: 1.5,
    borderColor: withAlpha(colors.silver, 0.18),
    fontFamily: typography.fontFamily.sans,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.gold,
  },
  errorText: {
    fontFamily: typography.fontFamily.sans,
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },

  ctaBtn: {
    height: 56,
    backgroundColor: colors.gold,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginBottom: 10,
  },
  ctaText: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 13,
    letterSpacing: 2.2,
    color: colors.navy,
    textTransform: 'uppercase',
  },
  legalText: {
    fontFamily: typography.fontFamily.sans,
    color: colors.silver,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    opacity: 0.65,
  },
});
