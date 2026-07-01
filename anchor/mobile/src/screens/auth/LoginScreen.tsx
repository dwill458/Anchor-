/**
 * Anchor App - Login Screen
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
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
import { AuthService } from '../../services/AuthService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import PostAuthFlowService from '../../services/PostAuthFlowService';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import type {
  AuthScreenInitialTab,
  AuthScreenParams,
  RootStackParamList,
} from '@/types';

type AuthTab = AuthScreenInitialTab;
type FocusedField = 'name' | 'email' | 'password' | 'confirmPassword' | null;

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
  route?: { params?: AuthScreenParams };
}

const ANCHOR_GOLD = require('../../assets/images/anchor-gold.png');

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, route }) => {
  const initialTab = route?.params?.initialTab ?? 'signin';
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [name, setName] = useState('');
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;

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
            toValue: -8,
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

    // Profile/settings auth is presented as a modal stack over Main. Close it
    // after sign-in so the user returns to the now-authenticated app surface.
    if (
      (routeNames.includes('Profile') || routeNames.includes('Settings')) &&
      navigation.canGoBack()
    ) {
      navigation.goBack();
    }
  };

  // Hand off to the SaveProgress gate, which finalizes the pending first anchor
  // (attaches it to the new account) before entering the Vault.
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
    } else if (context === 'paywall') {
      navigateAfterSuccessfulAuth('Vault');
    } else if (context == null || context === 'onboarding') {
      navigateAfterSuccessfulAuth('Vault');
    }
  };

  const handleLogin = async () => {
    resetError();
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      FrictionAnalytics.flowBlocked('onboarding_auth', 'login', 'missing_credentials', { context });
      return;
    }

    setLoading(true);
    FrictionAnalytics.stepCompleted('onboarding_auth', 'auth_started', {
      provider: 'email',
      mode: 'signin',
      context,
    });
    try {
      const result = await AuthService.signInWithEmail(email, password, {
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
      setError(err.message || 'Login failed');
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
    if (!email.trim() || !password) {
      setError('Please enter your email and a password');
      FrictionAnalytics.flowBlocked('onboarding_auth', 'signup', 'missing_fields', { context });
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
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
      const result = await AuthService.signUpWithEmail(email, password, name, {
        hasCompletedOnboarding: shouldMarkOnboardingCompletedForAuth() ? true : undefined,
        allowBackendCreate: true,
      });
      await completeAuth(result);
      AnalyticsService.track(AnalyticsEvents.SIGN_UP_COMPLETED, {
        provider: 'email',
        context,
      });
      // No-card trial begins at account creation; mark the funnel entry.
      AnalyticsService.track(AnalyticsEvents.TRIAL_STARTED, { provider: 'email', context });
      FrictionAnalytics.completeFlow('onboarding_auth', {
        provider: 'email',
        mode: 'signup',
        context,
      });
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
      FrictionAnalytics.flowError('onboarding_auth', 'signup', 'signup_failed', {
        provider: 'email',
        context,
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

    if (!resetEmail) {
      setError('Enter your email first to reset your password');
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
        });
        Alert.alert('Google sign-in', message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const isSignIn = tab === 'signin';
  const ctaCopy = isSignIn ? 'ENTER THE SANCTUARY' : 'FORGE YOUR PATH';
  const showGoogleSignIn = ENABLE_GOOGLE_SIGN_IN;

  const renderField = (
    key: Exclude<FocusedField, null>,
    label: string,
    value: string,
    onChangeText: (nextValue: string) => void,
    options?: {
      autoCapitalize?: 'none' | 'words';
      keyboardType?: 'default' | 'email-address';
      secureTextEntry?: boolean;
      placeholder?: string;
      showToggle?: boolean;
      shown?: boolean;
      onToggle?: () => void;
    }
  ) => {
    const isFocused = focusedField === key;

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View>
          <TextInput
            style={[
              styles.input,
              isFocused ? styles.inputFocused : null,
              options?.showToggle ? styles.inputWithToggle : null,
            ]}
            value={value}
            onChangeText={(nextValue) => {
              resetError();
              onChangeText(nextValue);
            }}
            placeholder={options?.placeholder}
            placeholderTextColor="rgba(245,245,220,0.3)"
            autoCapitalize={options?.autoCapitalize ?? 'none'}
            keyboardType={options?.keyboardType ?? 'default'}
            secureTextEntry={options?.secureTextEntry ? !options?.shown : false}
            onFocus={() => setFocusedField(key)}
            onBlur={() => setFocusedField(null)}
          />
          {options?.showToggle ? (
            <Pressable onPress={options.onToggle} style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>{options.shown ? 'HIDE' : 'SHOW'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#3E2C5B', '#1a1230', '#080C10']}
      locations={[0, 0.3, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
              <Animated.View style={[styles.logoWrap, { transform: [{ translateY: floatAnim }] }]}>
                <Animated.View style={[styles.logoGlow, { opacity: glowAnim }]} />
                <Animated.View style={[styles.logoGlowOuter, { opacity: glowAnim }]} />
                <Image source={ANCHOR_GOLD} style={styles.logoImage} resizeMode="contain" />
              </Animated.View>

              <Text style={styles.wordmark}>ANCHOR</Text>
              <Text style={styles.subtitle}>Transform intentions into power</Text>

              <View style={styles.card}>
                <View style={styles.tabRow}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      resetError();
                      setTab('signin');
                    }}
                    style={styles.tabButton}
                  >
                    {isSignIn ? (
                      <LinearGradient
                        colors={['#D4AF37', '#8B6914']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.activeTab}
                      >
                        <Text style={styles.activeTabText}>SIGN IN</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.inactiveTab}>
                        <Text style={styles.inactiveTabText}>SIGN IN</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      resetError();
                      setTab('signup');
                    }}
                    style={styles.tabButton}
                  >
                    {!isSignIn ? (
                      <LinearGradient
                        colors={['#D4AF37', '#8B6914']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.activeTab}
                      >
                        <Text style={styles.activeTabText}>SIGN UP</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.inactiveTab}>
                        <Text style={styles.inactiveTabText}>SIGN UP</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.ssoRow}>
                  {isAppleAvailable ? (
                    <View style={styles.ssoButtonWrap}>
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                        cornerRadius={11}
                        style={styles.appleButton}
                        onPress={() => {
                          void handleAppleSignIn();
                        }}
                      />
                    </View>
                  ) : null}

                  {showGoogleSignIn ? (
                    <View style={styles.ssoButtonWrap}>
                      <TouchableOpacity
                        style={[styles.googleButton, loading ? styles.ssoButtonDisabled : null]}
                        onPress={() => void handleGoogleSignIn()}
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
                    {isAppleAvailable || showGoogleSignIn ? 'or continue with email' : 'continue with email'}
                  </Text>
                  <View style={styles.dividerLine} />
                </View>

                {!isSignIn
                  ? renderField('name', 'NAME (OPTIONAL)', name, setName, {
                    autoCapitalize: 'words',
                    placeholder: 'What should we call you?',
                  })
                  : null}

                {renderField('email', 'EMAIL', email, setEmail, {
                  keyboardType: 'email-address',
                  placeholder: 'you@example.com',
                })}

                {renderField('password', 'PASSWORD', password, setPassword, {
                  placeholder: 'At least 8 characters',
                  secureTextEntry: true,
                  showToggle: true,
                  shown: showPassword,
                  onToggle: () => setShowPassword((current) => !current),
                })}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {isSignIn ? (
                  <TouchableOpacity
                    onPress={() => {
                      void handleForgotPassword();
                    }}
                    disabled={loading}
                    style={styles.forgotPasswordButton}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.ctaButton} onPress={handleSubmit} disabled={loading}>
                  <LinearGradient
                    colors={['#D4AF37', '#B8962E', '#8B6914']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.ctaGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#080C10" />
                    ) : (
                      <Text style={styles.ctaText}>{ctaCopy}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    resetError();
                    setTab(isSignIn ? 'signup' : 'signin');
                  }}
                  disabled={loading}
                  style={styles.switchLinkButton}
                >
                  {isSignIn ? (
                    <Text style={styles.switchLinkText}>
                      New to Anchor? <Text style={styles.switchLinkAccent}>Begin your practice</Text>
                    </Text>
                  ) : (
                    <Text style={styles.switchLinkText}>
                      Already forged? <Text style={styles.switchLinkAccent}>Sign in</Text>
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.trialText}>7-DAY FREE TRIAL · NO CARD REQUIRED</Text>
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
    paddingVertical: 28,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoGlow: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.75)',
    backgroundColor: 'transparent',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  logoGlowOuter: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'transparent',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  logoImage: {
    width: 110,
    height: 110,
  },
  wordmark: {
    textAlign: 'center',
    fontFamily: typography.fonts.headingBold,
    fontSize: 32,
    letterSpacing: 8,
    color: '#D4AF37',
    textShadowColor: 'rgba(212,175,55,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 14,
    letterSpacing: 2,
    color: 'rgba(245,245,220,0.45)',
    marginBottom: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,20,25,0.82)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    padding: 28,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(8,12,16,0.6)',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
    marginBottom: 28,
  },
  tabButton: {
    flex: 1,
  },
  activeTab: {
    borderRadius: 7,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveTab: {
    borderRadius: 7,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabText: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#080C10',
  },
  inactiveTabText: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(245,245,220,0.45)',
  },
  ssoRow: {
    flexDirection: 'row',
    gap: 10,
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
    fontFamily: typography.fonts.headingBold,
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
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  dividerText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(245,245,220,0.2)',
  },
  inputGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(212,175,55,0.7)',
    marginBottom: 7,
  },
  input: {
    backgroundColor: 'rgba(8,12,16,0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    paddingVertical: 13,
    paddingHorizontal: 16,
    color: '#F5F5DC',
    fontFamily: typography.fonts.bodySerif,
    fontSize: 15,
  },
  inputWithToggle: {
    paddingRight: 62,
  },
  inputFocused: {
    borderColor: 'rgba(212,175,55,0.55)',
  },
  toggleButton: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 1,
    color: '#D4AF37',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: typography.fonts.body,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    textAlign: 'right',
    color: '#D4AF37',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
  },
  ctaButton: {
    borderRadius: 11,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ctaText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 11,
    letterSpacing: 3,
    color: '#080C10',
  },
  switchLinkButton: {
    marginTop: 18,
  },
  switchLinkText: {
    textAlign: 'center',
    color: 'rgba(245,245,220,0.35)',
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
  },
  switchLinkAccent: {
    color: '#D4AF37',
    fontFamily: typography.fonts.bodySerifItalic,
  },
  trialText: {
    marginTop: 20,
    textAlign: 'center',
    fontFamily: typography.fonts.heading,
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(245,245,220,0.25)',
  },
});

export default LoginScreen;
