/**
 * TrialSignUpScreen — Account creation gate between first prime and Sanctuary.
 *
 * Flow: FirstPrimeCompleteScreen (tap) → here → Vault (Sanctuary)
 *
 * Three exits:
 *  1. Start Free Trial  — signs up then navigates to Vault
 *  2. Skip              — navigates directly to Vault
 *  3. Sign In           — navigates to Login (which lands in Vault on success)
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
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';

type TrialNavProp = StackNavigationProp<RootStackParamList, 'TrialSignUp'>;

const BENEFITS = [
  { icon: '⚡', label: 'Forge unlimited anchors' },
  { icon: '✦', label: 'AI sigil enhancement' },
  { icon: '◎', label: 'Full practice tracking & streaks' },
  { icon: '☁', label: 'Sync across devices' },
];

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

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

  const goToVault = useCallback(() => {
    navigation.replace('Vault');
  }, [navigation]);

  const handleSignUp = async () => {
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
      await PostAuthFlowService.run({
        user: result.user,
        token: result.token,
        preserveCompletedOnboarding: true,
        launchTrialPurchase: true,
      });
      navigateToVaultDestination(navigation, 'replace');
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

            {/* Sign-in link */}
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => navigation.navigate('Login')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>

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

              <Text style={styles.headline}>
                All access.{'\n'}Free for a week.
              </Text>
              <Text style={styles.subheadline}>
                Save your anchor and sync your practice across devices.
                {'\n'}Cancel anytime — no payment now.
              </Text>
            </View>

            {/* Benefits list */}
            <View style={styles.benefits}>
              {BENEFITS.map((b) => (
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

            {/* Form card */}
            <View style={styles.card}>
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
                <Text style={styles.ctaText}>START FREE TRIAL</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.legalText}>No payment required. Cancel anytime.</Text>

            {/* Skip */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={goToVault}
              hitSlop={{ top: 14, bottom: 14, left: 20, right: 20 }}
            >
              <Text style={styles.skipText}>Continue without an account →</Text>
            </TouchableOpacity>

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
    marginBottom: 28,
    opacity: 0.65,
  },

  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    fontFamily: typography.fontFamily.sans,
    color: colors.silver,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
