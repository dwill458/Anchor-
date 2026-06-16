/**
 * Anchor App - Sign Up Screen (Optimized for Android)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StackNavigationProp } from '@react-navigation/stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, typography } from '@/theme';
import { ENABLE_GOOGLE_SIGN_IN } from '@/config';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { AuthService } from '../../services/AuthService';
import PostAuthFlowService from '../../services/PostAuthFlowService';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import type { AuthScreenParams, RootStackParamList } from '@/types';

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUp'>;

interface SignUpScreenProps {
  navigation: SignUpScreenNavigationProp;
  route?: { params?: AuthScreenParams };
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation, route }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const setPreferredPlanId = useSubscriptionStore((state) => state.setPreferredPlanId);
  const context = route?.params?.context;
  const preferredPlanId = route?.params?.preferredPlanId;

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let mounted = true;
    void AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setIsAppleAvailable(available);
      })
      .catch(() => {
        if (mounted) setIsAppleAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const resetError = () => {
    if (error) {
      setError('');
    }
  };

  const shouldMarkOnboardingCompletedForAuth = () =>
    context == null ||
    context === 'onboarding' ||
    context === 'first_anchor_gate' ||
    context === 'save_progress' ||
    context === 'paywall';

  const navigateAfterSuccessfulAuth = (target: 'Vault' | 'FirstAnchorAccountGate') => {
    const routeNames = (navigation.getState?.().routeNames ?? []) as readonly string[];

    if (routeNames.includes(target)) {
      if (target === 'Vault') {
        navigateToVaultDestination(navigation, 'replace');
        return;
      }

      navigation.replace(target);
      return;
    }

    if (
      target === 'Vault' &&
      (routeNames.includes('Profile') || routeNames.includes('Settings')) &&
      navigation.canGoBack()
    ) {
      navigation.goBack();
    }
  };

  const completeAuth = async (result: Awaited<ReturnType<typeof AuthService.signUpWithEmail>>) => {
    if (preferredPlanId) {
      setPreferredPlanId(preferredPlanId);
    }

    const shouldCompleteOnboardingAfterAuth =
      hasCompletedOnboarding ||
      shouldMarkOnboardingCompletedForAuth();

    await PostAuthFlowService.run({
      user: result.user,
      token: result.token,
      preserveCompletedOnboarding: shouldCompleteOnboardingAfterAuth,
      launchTrialPurchase: false,
    });

    const shouldRouteThroughFirstAnchorGate = Boolean(
      useAuthStore.getState().pendingFirstAnchorDraft
    );

    if (context === 'first_anchor_gate') {
      navigateAfterSuccessfulAuth('FirstAnchorAccountGate');
    } else if (context === 'save_progress' && shouldRouteThroughFirstAnchorGate) {
      navigateAfterSuccessfulAuth('FirstAnchorAccountGate');
    } else if (context === 'save_progress') {
      navigateAfterSuccessfulAuth('Vault');
    } else if (context === 'paywall' || context == null || context === 'onboarding') {
      navigateAfterSuccessfulAuth('Vault');
    }
  };

  const handleSignUp = async () => {
    resetError();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await AuthService.signUpWithEmail(email, password, name, {
        hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
        allowBackendCreate: true,
      });
      await completeAuth(result);
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignUp = () => {
    resetError();
    setLoading(true);
    void (async () => {
      try {
        const result = await AuthService.signInWithApple({
          hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
          allowBackendCreate: true,
        });
        await completeAuth(result);
      } catch (err: any) {
        if (err?.code === 'ERR_REQUEST_CANCELED') {
          return;
        }
        const message = err?.message || 'Apple sign-up failed';
        setError(message);
        Alert.alert('Apple sign-up', message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleGoogleSignUp = () => {
    resetError();
    setLoading(true);
    void (async () => {
      try {
        const result = await AuthService.signInWithGoogle({
          hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
          allowBackendCreate: true,
        });
        await completeAuth(result);
      } catch (err: any) {
        if (err?.message === 'Google sign-in was cancelled.') {
          return;
        }
        const message = err?.message || 'Google sign-up failed';
        setError(message);
        Alert.alert('Google sign-up', message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const showGoogleSignUp = ENABLE_GOOGLE_SIGN_IN;



  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.navy, colors.deepPurple, colors.charcoal]}
        style={styles.backgroundGradient}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
              <View style={styles.header}>
                <Text style={styles.logo}>⚓</Text>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Begin your journey of intentional living</Text>
              </View>

              <View style={[styles.card, Platform.OS === 'android' && styles.androidCard]}>
                {Platform.OS === 'ios' && (
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.cardInner}>
                  <View style={styles.ssoRow}>
                    {isAppleAvailable ? (
                      <View style={styles.ssoButtonWrap}>
                        <AppleAuthentication.AppleAuthenticationButton
                          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                          cornerRadius={11}
                          style={styles.appleButton}
                          onPress={() => {
                            void handleAppleSignUp();
                          }}
                        />
                      </View>
                    ) : null}

                    {showGoogleSignUp ? (
                      <View style={styles.ssoButtonWrap}>
                        <TouchableOpacity
                          style={[styles.googleButton, loading ? styles.ssoButtonDisabled : null]}
                          onPress={() => void handleGoogleSignUp()}
                          disabled={loading}
                          activeOpacity={0.85}
                        >
                          <View style={styles.googleBadge}>
                            <Text style={styles.googleBadgeText}>G</Text>
                          </View>
                          <Text style={styles.googleButtonText}>Continue with Google</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>
                      {isAppleAvailable || showGoogleSignUp ? 'or continue with email' : 'continue with email'}
                    </Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                      style={[styles.input, focusedField === 'name' && styles.inputFocused]}
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter your name"
                      placeholderTextColor={colors.silver}
                      autoCapitalize="words"
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.silver}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      style={[styles.input, focusedField === 'password' && styles.inputFocused]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor={colors.silver}
                      secureTextEntry
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput
                      style={[styles.input, focusedField === 'confirm' && styles.inputFocused]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor={colors.silver}
                      secureTextEntry
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
                    <LinearGradient colors={[colors.gold, '#B8941F']} style={styles.buttonGradient}>
                      {loading ? <ActivityIndicator color={colors.charcoal} /> : <Text style={styles.buttonText}>Create Account</Text>}
                    </LinearGradient>
                  </TouchableOpacity>


                </View>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login', route?.params)}>
                  <Text style={styles.footerLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  backgroundGradient: { ...StyleSheet.absoluteFillObject },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 64, marginBottom: 10 },
  title: { fontSize: 32, fontFamily: typography.fonts.heading, color: colors.gold, letterSpacing: 1 },
  subtitle: { fontSize: 16, color: colors.silver, textAlign: 'center' },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  androidCard: { backgroundColor: 'rgba(26, 26, 29, 0.95)' },
  cardInner: { padding: 24 },
  ssoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  ssoButtonWrap: {
    flex: 1,
    minHeight: 48,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  googleButton: {
    width: '100%',
    height: 48,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(8,12,16,0.08)',
  },
  googleBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBadgeText: {
    color: '#4285F4',
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    lineHeight: 20,
  },
  googleButtonText: {
    flex: 1,
    color: '#1F1F1F',
    fontFamily: typography.fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  ssoButtonDisabled: {
    opacity: 0.65,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  dividerText: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(245, 245, 220, 0.2)',
  },
  inputGroup: { marginBottom: 16 },
  label: { color: colors.bone, marginBottom: 6, fontSize: 14, fontWeight: '600' },
  input: { height: 56, backgroundColor: 'rgba(15, 20, 25, 0.5)', borderRadius: 12, paddingHorizontal: 16, color: colors.bone, borderWidth: 2, borderColor: 'rgba(192, 192, 192, 0.2)' },
  inputFocused: { borderColor: colors.gold },
  errorText: { color: colors.error, textAlign: 'center', marginBottom: 16 },
  button: { borderRadius: 12, overflow: 'hidden', marginTop: 10 },
  buttonGradient: { height: 56, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.charcoal, fontSize: 16, fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.silver, fontSize: 16 },
  footerLink: { color: colors.gold, fontWeight: '700', fontSize: 16 },
});

export default SignUpScreen;
