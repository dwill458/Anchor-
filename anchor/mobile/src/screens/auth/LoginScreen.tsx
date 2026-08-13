/**
 * Anchor App - Login Screen
 * Aligned with 26 Sign In.html spec
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, typography } from '@/theme';
import { ENABLE_GOOGLE_SIGN_IN } from '@/config';
import { useAuthStore } from '../../stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { useProfileStore } from '@/stores/profileStore';
import { AuthService } from '../../services/AuthService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import PostAuthFlowService from '../../services/PostAuthFlowService';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import type {
  AuthScreenInitialTab,
  AuthScreenParams,
  RootStackParamList,
} from '@/types';

type AuthTab = AuthScreenInitialTab;
type FocusedField = 'name' | 'email' | 'password' | null;

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
  route?: { params?: AuthScreenParams };
}

const ANCHOR_GOLD = require('../../assets/images/anchor-logo-official.png');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, route }) => {
  const initialTab = route?.params?.initialTab ?? 'signin';
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [name, setName] = useState(
    () => useFirstAnchorFlowStore.getState().draft?.onboardingName ?? ''
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const setPreferredPlanId = useSubscriptionStore((state) => state.setPreferredPlanId);
  const context = route?.params?.context;
  const preferredPlanId = route?.params?.preferredPlanId;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const tabAnim = useRef(new Animated.Value(initialTab === 'signup' ? 1 : 0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: tab === 'signup' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [tab, tabAnim]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -6,
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.45,
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [fadeAnim, floatAnim, glowAnim]);

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

  const navigateAfterSuccessfulAuth = (target: 'Vault') => {
    const routeNames = (navigation.getState?.().routeNames ?? []) as readonly string[];

    if (routeNames.includes(target)) {
      navigateToVaultDestination(navigation, 'replace');
      return;
    }

    if (
      (routeNames.includes('Profile') || routeNames.includes('Settings')) &&
      navigation.canGoBack()
    ) {
      navigation.goBack();
    }
  };

  const finalizeFirstAnchorThenVault = () => {
    const routeNames = (navigation.getState?.().routeNames ?? []) as readonly string[];
    const anchorId =
      route?.params?.anchorId ?? useAuthStore.getState().pendingFirstAnchorDraft?.tempAnchorId;
    const anchor = anchorId ? useAnchorStore.getState().getAnchorById(anchorId) : null;
    if (anchorId && routeNames.includes('SaveProgress')) {
      if (anchor) {
        navigation.replace('SaveProgress', { anchor });
        return;
      }
    }
    navigateAfterSuccessfulAuth('Vault');
  };

  const completeAuth = async (result: Awaited<ReturnType<typeof AuthService.signInWithEmail>>) => {
    if (preferredPlanId) {
      setPreferredPlanId(preferredPlanId);
    }

    if (name.trim()) {
      useProfileStore.getState().updateProfile({ name: name.trim() });
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
      finalizeFirstAnchorThenVault();
    } else if (context === 'save_progress' && shouldRouteThroughFirstAnchorGate) {
      finalizeFirstAnchorThenVault();
    } else if (context === 'save_progress') {
      navigateAfterSuccessfulAuth('Vault');
    } else if (context === 'paywall' || context == null || context === 'onboarding') {
      navigateAfterSuccessfulAuth('Vault');
    }
  };

  const handleLogin = async () => {
    resetError();
    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      FrictionAnalytics.flowBlocked('onboarding_auth', 'login', 'invalid_email', { context });
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      FrictionAnalytics.flowBlocked('onboarding_auth', 'login', 'missing_password', { context });
      return;
    }

    setLoading(true);
    FrictionAnalytics.stepCompleted('onboarding_auth', 'auth_started', {
      provider: 'email',
      mode: 'signin',
      context,
    });
    try {
      const result = await AuthService.signInWithEmail(cleanEmail, password, {
        hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
        allowBackendCreate: false,
      });
      await completeAuth(result);
      AnalyticsService.track(AnalyticsEvents.SIGN_IN_COMPLETED, {
        provider: 'email',
        context,
      });
      FrictionAnalytics.completeFlow('onboarding_auth', {
        provider: 'email',
        mode: 'signin',
        context,
      });
    } catch (err: any) {
      setError('Incorrect email or password.');
      FrictionAnalytics.flowError('onboarding_auth', 'login', 'signin_failed', {
        provider: 'email',
        context,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    resetError();
    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      FrictionAnalytics.flowBlocked('onboarding_auth', 'signup', 'invalid_email', { context });
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      FrictionAnalytics.flowBlocked('onboarding_auth', 'signup', 'password_too_short', { context });
      return;
    }

    setLoading(true);
    FrictionAnalytics.stepCompleted('onboarding_auth', 'auth_started', {
      provider: 'email',
      mode: 'signup',
      context,
    });
    try {
      const result = await AuthService.signUpWithEmail(cleanEmail, password, name.trim(), {
        hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
        allowBackendCreate: true,
      });
      await completeAuth(result);
      AnalyticsService.track(AnalyticsEvents.SIGN_UP_COMPLETED, {
        provider: 'email',
        context,
      });
      AnalyticsService.track(AnalyticsEvents.TRIAL_STARTED, { provider: 'email', context });
      FrictionAnalytics.completeFlow('onboarding_auth', {
        provider: 'email',
        mode: 'signup',
        context,
      });
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('exist') || err?.code === 'auth/email-already-in-use') {
        setError('An account already exists with this email.');
      } else {
        setError(err.message || 'An account already exists with this email.');
      }
      FrictionAnalytics.flowError('onboarding_auth', 'signup', 'signup_failed', {
        provider: 'email',
        context,
        error_code: err?.code,
        error_message: err?.message,
      });
      ErrorTrackingService.captureException(err, {
        screen: 'LoginScreen',
        action: 'signup_email',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (tab === 'signin') {
      void handleLogin();
      return;
    }

    void handleSignUp();
  };

  const handleForgotPassword = async () => {
    resetError();
    const resetEmail = email.trim().toLowerCase();

    if (!resetEmail || !EMAIL_RE.test(resetEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await AuthService.sendPasswordResetEmail(resetEmail);
      Alert.alert(
        'Reset email sent',
        `If an Anchor account exists for ${resetEmail}, a reset link will arrive shortly.`
      );
    } catch (err: any) {
      setError(err.message || 'Unable to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    resetError();
    setLoading(true);
    FrictionAnalytics.stepCompleted('onboarding_auth', 'auth_started', {
      provider: 'apple',
      mode: tab,
      context,
    });
    void (async () => {
      try {
        const result = await AuthService.signInWithApple({
          hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
          allowBackendCreate: !isSignIn,
        });
        await completeAuth(result);
        AnalyticsService.track(
          tab === 'signup' ? AnalyticsEvents.SIGN_UP_COMPLETED : AnalyticsEvents.SIGN_IN_COMPLETED,
          {
            provider: 'apple',
            context,
          }
        );
        if (result.isNewUser) {
          AnalyticsService.track(AnalyticsEvents.TRIAL_STARTED, { provider: 'apple', context });
        }
        FrictionAnalytics.completeFlow('onboarding_auth', {
          provider: 'apple',
          mode: tab,
          context,
        });
      } catch (err: any) {
        if (err?.code === 'ERR_REQUEST_CANCELED') {
          FrictionAnalytics.stepAbandoned('onboarding_auth', 'apple_auth', 'provider_cancelled', {
            context,
          });
          return;
        }
        const message = err?.message || 'Apple sign-in failed';
        setError(message);
        FrictionAnalytics.flowError('onboarding_auth', 'apple_auth', 'apple_auth_failed', {
          context,
          error_code: err?.code,
          error_message: message,
        });
        ErrorTrackingService.captureException(err, {
          screen: 'LoginScreen',
          action: 'apple_sign_in',
        });
        Alert.alert('Apple sign-in', message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleGoogleSignIn = () => {
    resetError();
    setLoading(true);
    FrictionAnalytics.stepCompleted('onboarding_auth', 'auth_started', {
      provider: 'google',
      mode: tab,
      context,
    });
    void (async () => {
      try {
        const result = await AuthService.signInWithGoogle({
          hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
          allowBackendCreate: !isSignIn,
        });
        await completeAuth(result);
        AnalyticsService.track(
          tab === 'signup' ? AnalyticsEvents.SIGN_UP_COMPLETED : AnalyticsEvents.SIGN_IN_COMPLETED,
          {
            provider: 'google',
            context,
          }
        );
        if (result.isNewUser) {
          AnalyticsService.track(AnalyticsEvents.TRIAL_STARTED, { provider: 'google', context });
        }
        FrictionAnalytics.completeFlow('onboarding_auth', {
          provider: 'google',
          mode: tab,
          context,
        });
      } catch (err: any) {
        if (err?.message === 'Google sign-in was cancelled.') {
          FrictionAnalytics.stepAbandoned('onboarding_auth', 'google_auth', 'provider_cancelled', {
            context,
          });
          return;
        }
        const message = err?.message || 'Google sign-in failed';
        setError(message);
        FrictionAnalytics.flowError('onboarding_auth', 'google_auth', 'google_auth_failed', {
          context,
          error_code: err?.code,
          error_message: message,
        });
        ErrorTrackingService.captureException(err, {
          screen: 'LoginScreen',
          action: 'google_sign_in',
        });
        Alert.alert('Google sign-in', message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const isSignIn = tab === 'signin';
  const showGoogleSignIn = ENABLE_GOOGLE_SIGN_IN;

  const pillLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <LinearGradient
      colors={['#0F1419', '#0B1015', '#121820']}
      locations={[0, 0.45, 1]}
      style={styles.container}
    >
      <View style={styles.bgRings} pointerEvents="none">
        <View style={styles.ring1} />
        <View style={styles.ring2} />
        <View style={styles.orbGold} />
        <View style={styles.orbViolet} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
              {/* Header */}
              <Animated.View style={[styles.logoWrap, { transform: [{ translateY: floatAnim }] }]}>
                <Animated.View style={[styles.logoHalo, { opacity: glowAnim }]} />
                <Animated.View style={[styles.logoRing, { opacity: glowAnim }]} />
                <Image
                  source={ANCHOR_GOLD}
                  style={styles.logoImage}
                  resizeMode="contain"
                  accessible
                  accessibilityLabel="Anchor logo"
                />
              </Animated.View>

              <Text style={styles.wordmark}>ANCHOR</Text>
              <Text style={styles.descriptor}>Visual Goal Setting</Text>
              <Text style={styles.subline}>Turn what matters into something you can return to.</Text>

              {/* Form Card */}
              <View style={styles.card}>
                {/* Segmented Sliding Tabs */}
                <View style={styles.tabsContainer} role="tablist" accessibilityLabel="Sign in or sign up">
                  <Animated.View style={[styles.tabPill, { left: pillLeft }]} />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    role="tab"
                    accessibilityState={{ selected: isSignIn }}
                    onPress={() => {
                      resetError();
                      setTab('signin');
                    }}
                    style={styles.tabButton}
                  >
                    <Text style={[styles.tabText, isSignIn ? styles.tabTextActive : null]}>
                      Sign in
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    role="tab"
                    accessibilityState={{ selected: !isSignIn }}
                    onPress={() => {
                      resetError();
                      setTab('signup');
                    }}
                    style={styles.tabButton}
                  >
                    <Text style={[styles.tabText, !isSignIn ? styles.tabTextActive : null]}>
                      Sign up
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Form fields in spec order */}
                {/* 1. Continue with Google (and Apple if available) */}
                <View style={styles.ssoRow}>
                  {showGoogleSignIn ? (
                    <TouchableOpacity
                      style={[styles.googleButton, loading ? styles.ssoButtonDisabled : null]}
                      onPress={() => void handleGoogleSignIn()}
                      disabled={loading}
                      activeOpacity={0.85}
                      accessibilityLabel="Continue with Google"
                    >
                      <View style={styles.googleBadge}>
                        <Text style={styles.googleBadgeText}>G</Text>
                      </View>
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </TouchableOpacity>
                  ) : null}

                  {isAppleAvailable ? (
                    <View style={styles.appleButtonWrap}>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                        cornerRadius={10}
                        style={styles.appleButton}
                        onPress={() => {
                          void handleAppleSignIn();
                        }}
                      />
                    </View>
                  ) : null}
                </View>

                {/* 2. Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with email</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* 3. Name (Optional) - Sign up only */}
                {!isSignIn ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Name · Optional</Text>
                    <TextInput
                      style={[styles.input, focusedField === 'name' ? styles.inputFocused : null]}
                      value={name}
                      onChangeText={(val) => {
                        resetError();
                        setName(val);
                      }}
                      placeholder="What should we call you?"
                      placeholderTextColor="rgba(244,239,230,0.32)"
                      autoCapitalize="words"
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                ) : null}

                {/* 4. Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={[styles.input, focusedField === 'email' ? styles.inputFocused : null]}
                    value={email}
                    onChangeText={(val) => {
                      resetError();
                      setEmail(val);
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(244,239,230,0.32)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>

                {/* 5. Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.inputWithToggle,
                        focusedField === 'password' ? styles.inputFocused : null,
                      ]}
                      value={password}
                      onChangeText={(val) => {
                        resetError();
                        setPassword(val);
                      }}
                      placeholder="At least 8 characters"
                      placeholderTextColor="rgba(244,239,230,0.32)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      style={styles.toggleButton}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Text style={styles.toggleButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Forgot password link - Sign in only */}
                {isSignIn ? (
                  <TouchableOpacity
                    onPress={() => {
                      void handleForgotPassword();
                    }}
                    disabled={loading}
                    style={styles.forgotRow}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                ) : null}

                {/* Error Banner */}
                {error ? (
                  <View style={styles.errorBanner} role="alert">
                    <View style={styles.errorDot} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Primary CTA */}
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#D9B36C', '#B58F28']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.ctaGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#0F1419" />
                    ) : (
                      <Text style={styles.ctaText}>
                        {isSignIn ? 'Sign in →' : 'Create account →'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Terms and Privacy Policy legal copy - Sign up only */}
                {!isSignIn ? (
                  <Text style={styles.legalCopy}>
                    By continuing, you agree to the{' '}
                    <Text
                      style={styles.legalLink}
                      onPress={() => void Linking.openURL('https://anchorintentions.com/terms')}
                    >
                      Terms
                    </Text>{' '}
                    and{' '}
                    <Text
                      style={styles.legalLink}
                      onPress={() => void Linking.openURL('https://anchorintentions.com/privacy')}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                ) : null}

                {/* Switch link */}
                <TouchableOpacity
                  onPress={() => {
                    resetError();
                    setTab(isSignIn ? 'signup' : 'signin');
                  }}
                  disabled={loading}
                  style={styles.switchLinkButton}
                >
                  <Text style={styles.switchLinkText}>
                    {isSignIn ? 'New to Anchor? ' : 'Already have an account? '}
                    <Text style={styles.switchLinkAccent}>
                      {isSignIn ? 'Create account' : 'Sign in'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgRings: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ring1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.06)',
  },
  ring2: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.04)',
  },
  orbGold: {
    position: 'absolute',
    top: -60,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(217,179,108,0.06)',
  },
  orbViolet: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(139,131,155,0.06)',
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoHalo: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(217,179,108,0.12)',
  },
  logoRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.3)',
  },
  logoImage: {
    width: 90,
    height: 90,
  },
  wordmark: {
    textAlign: 'center',
    fontFamily: typography.fonts.headingBold,
    fontSize: 26,
    letterSpacing: 6,
    color: '#D9B36C',
    marginBottom: 2,
  },
  descriptor: {
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(244,239,230,0.5)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subline: {
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: 'rgba(244,239,230,0.65)',
    marginBottom: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,20,25,0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.18)',
    padding: 22,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(8,12,16,0.6)',
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.12)',
    marginBottom: 20,
    position: 'relative',
    height: 40,
  },
  tabPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '50%',
    borderRadius: 999,
    backgroundColor: 'rgba(217,179,108,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.34)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 14,
    color: 'rgba(244,239,230,0.5)',
  },
  tabTextActive: {
    fontFamily: typography.fonts.headingSemiBold,
    color: '#F4EFE6',
    fontWeight: '600',
  },
  ssoRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },
  googleButton: {
    width: '100%',
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  googleBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBadgeText: {
    color: '#4285F4',
    fontFamily: typography.fonts.headingBold,
    fontSize: 16,
    lineHeight: 18,
  },
  googleButtonText: {
    color: '#1F1F1F',
    fontFamily: typography.fonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
  appleButtonWrap: {
    width: '100%',
    height: 44,
  },
  appleButton: {
    width: '100%',
    height: 44,
  },
  ssoButtonDisabled: {
    opacity: 0.65,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(217,179,108,0.14)',
  },
  dividerText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    color: 'rgba(244,239,230,0.38)',
  },
  inputGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(217,179,108,0.7)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  passwordWrap: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(8,12,16,0.65)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.18)',
    paddingVertical: 11,
    paddingHorizontal: 14,
    color: '#F4EFE6',
    fontFamily: typography.fonts.body,
    fontSize: 14,
  },
  inputWithToggle: {
    paddingRight: 60,
  },
  inputFocused: {
    borderColor: 'rgba(217,179,108,0.6)',
  },
  toggleButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    color: 'rgba(217,179,108,0.8)',
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 14,
  },
  forgotText: {
    color: '#D9B36C',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(92,43,46,0.5)',
    borderWidth: 1,
    borderColor: '#5C2B2E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  errorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF8A80',
  },
  errorText: {
    flex: 1,
    color: '#FF8A80',
    fontFamily: typography.fonts.body,
    fontSize: 12,
  },
  ctaButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  ctaGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  ctaText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: '#0F1419',
    fontWeight: '600',
  },
  legalCopy: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    color: 'rgba(244,239,230,0.4)',
  },
  legalLink: {
    color: '#D9B36C',
    textDecorationLine: 'underline',
  },
  switchLinkButton: {
    marginTop: 16,
  },
  switchLinkText: {
    textAlign: 'center',
    color: 'rgba(244,239,230,0.45)',
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
  },
  switchLinkAccent: {
    color: '#D9B36C',
    fontFamily: typography.fonts.bodySerifItalic,
  },
});

export default LoginScreen;
