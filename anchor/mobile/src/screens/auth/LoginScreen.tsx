/**
 * Anchor App - Login Screen
 *
 * Anchor 2.0 presentation: the cream paper hero carries the sigil (its star warms once on
 * arrival, echoing the launch splash), and the form sits on the ink panel beneath — the same
 * two-world layout as V2AuthScreen, so every sign-in entry point reads as one product.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, typography } from '@/theme/v2';
import { ENABLE_GOOGLE_SIGN_IN } from '@/config';
import { useAuthStore } from '../../stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { AuthService } from '../../services/AuthService';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import PostAuthFlowService from '../../services/PostAuthFlowService';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import { GoogleIcon } from '@/screens/v2/auth/components/AuthSocialIcons';
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

/** The 2.0 sigil, ink on transparent; the same 1127 × 1396 canvas as the splash layers. */
const BRAND_MARK = require('../../assets/home/anchor-brand-mark.png');
const LANDSCAPE = require('../../assets/images/auth-landscape-valley.png');
const MARK_WIDTH = 64;
const MARK_HEIGHT = Math.round(MARK_WIDTH * (1396 / 1127));
/** Where the gold star sits on the mark's canvas. */
const STAR_X = MARK_WIDTH * (562 / 1127);
const STAR_Y = MARK_WIDTH * (731 / 1127);
const GLOW_SIZE = 96;

const INK_TEXT = colors.ink.text;
const GOLD = '#DFC08A';
const GOLD_DEEP = '#C5A065';
const PAPER_INK = '#171717';

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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotionEnabled();

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const willShowSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', () => setIsKeyboardVisible(true))
      : null;
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    const willHideSub = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => setIsKeyboardVisible(false))
      : null;

    return () => {
      showSub.remove();
      willShowSub?.remove();
      hideSub.remove();
      willHideSub?.remove();
    };
  }, []);

  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const setPreferredPlanId = useSubscriptionStore((state) => state.setPreferredPlanId);
  const context = route?.params?.context;
  const preferredPlanId = route?.params?.preferredPlanId;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // The star warms once on arrival, then settles to a low ember.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      glow.value = 0.35;
      return;
    }
    glow.value = withSequence(
      withDelay(320, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })),
      withTiming(0.35, { duration: 1400, easing: Easing.inOut(Easing.cubic) })
    );
  }, [glow, reduceMotion]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.85 + glow.value * 0.15 }],
  }));

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
      (routeNames.includes('Profile') ||
        routeNames.includes('Settings') ||
        routeNames.includes('V2Settings')) &&
      navigation.canGoBack()
    ) {
      navigation.goBack();
      return;
    }

    if (routeNames.includes('V2DevelopmentHome')) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        (navigation as any).replace('V2DevelopmentHome');
      }
      return;
    }

    if (navigation.canGoBack()) {
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
  const ctaCopy = isSignIn ? 'SIGN IN' : 'CREATE ACCOUNT';
  const showGoogleSignIn = ENABLE_GOOGLE_SIGN_IN;
  const isCompact = height < 750;

  const switchTab = (next: AuthTab) => {
    resetError();
    setTab(next);
  };

  const renderField = (
    key: Exclude<FocusedField, null>,
    label: string,
    icon: React.ReactNode,
    value: string,
    onChangeText: (nextValue: string) => void,
    options?: {
      autoCapitalize?: 'none' | 'words';
      keyboardType?: 'default' | 'email-address';
      autoComplete?: 'name' | 'email' | 'current-password' | 'new-password';
      secureTextEntry?: boolean;
      showToggle?: boolean;
      shown?: boolean;
      onToggle?: () => void;
      inputRef?: React.Ref<TextInput>;
      returnKeyType?: 'next' | 'done' | 'go';
      onSubmitEditing?: () => void;
      blurOnSubmit?: boolean;
      textContentType?: any;
    }
  ) => {
    const isFocused = focusedField === key;

    return (
      <View style={[styles.field, isFocused ? styles.fieldFocused : null]}>
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          ref={options?.inputRef}
          style={styles.fieldInput}
          value={value}
          onChangeText={(nextValue) => {
            resetError();
            onChangeText(nextValue);
          }}
          placeholder={label}
          accessibilityLabel={label}
          placeholderTextColor={INK_TEXT.tertiary}
          autoCapitalize={options?.autoCapitalize ?? 'none'}
          keyboardType={options?.keyboardType ?? 'default'}
          autoComplete={options?.autoComplete}
          textContentType={options?.textContentType}
          secureTextEntry={options?.secureTextEntry ? !options?.shown : false}
          returnKeyType={options?.returnKeyType}
          onSubmitEditing={options?.onSubmitEditing}
          blurOnSubmit={options?.blurOnSubmit}
          onFocus={() => {
            setFocusedField(key);
            if (key === 'password') {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }
          }}
          onBlur={() => setFocusedField(null)}
        />
        {options?.showToggle ? (
          <Pressable
            onPress={options.onToggle}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={options.shown ? 'Hide password' : 'Show password'}
            style={styles.fieldTrailing}
          >
            {options.shown ? (
              <EyeOff size={19} color={INK_TEXT.secondary} strokeWidth={1.75} />
            ) : (
              <Eye size={19} color={INK_TEXT.secondary} strokeWidth={1.75} />
            )}
          </Pressable>
        ) : null}
      </View>
    );
  };

  const fieldIconColor = INK_TEXT.tertiary;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible && styles.scrollContentKeyboard,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* UPPER WORLD: cream paper, the sigil, and the valley the ink panel rises out of. */}
          <View style={[styles.hero, { paddingTop: insets.top + 8 }, isKeyboardVisible && styles.heroKeyboard]}>
            <View style={styles.topRow}>
              <Pressable
                onPress={() => switchTab(isSignIn ? 'signup' : 'signin')}
                disabled={loading}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isSignIn ? 'Switch to Create account' : 'Switch to Sign in'}
                style={styles.contextualSwitch}
              >
                <Text style={styles.contextualSwitchText}>{isSignIn ? 'CREATE ACCOUNT' : 'SIGN IN'}</Text>
              </Pressable>
            </View>

            {!isKeyboardVisible ? (
              <>
                <Animated.View
                  entering={reduceMotion ? undefined : FadeInDown.duration(520)}
                  style={[styles.brandBlock, isCompact && styles.brandBlockCompact]}
                >
                  <View style={styles.markFrame}>
                    <Animated.View style={[styles.markGlow, glowStyle]} pointerEvents="none">
                      <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
                        <Defs>
                          {/* rx/ry are explicit: Android ignores `r` alone on a radial gradient. */}
                          <RadialGradient id="loginStarGlow" cx="50%" cy="50%" rx="50%" ry="50%" r="50%">
                            <Stop offset="0" stopColor="#E2BC6B" stopOpacity={0.6} />
                            <Stop offset="0.45" stopColor="#E2BC6B" stopOpacity={0.18} />
                            <Stop offset="1" stopColor="#E2BC6B" stopOpacity={0} />
                          </RadialGradient>
                        </Defs>
                        <Rect width={GLOW_SIZE} height={GLOW_SIZE} fill="url(#loginStarGlow)" />
                      </Svg>
                    </Animated.View>
                    <Image
                      source={BRAND_MARK}
                      style={styles.mark}
                      resizeMode="contain"
                      accessible
                      accessibilityLabel="Anchor"
                    />
                  </View>
                  <Text style={styles.wordmark}>ANCHOR</Text>
                  <Text style={styles.descriptor}>VISUAL GOAL SETTING</Text>
                  <View style={styles.editorialDivider} />
                  <Text style={styles.editorialCopy}>
                    {isSignIn ? 'Return to what matters.' : 'A stronger tomorrow\nstarts with what you create today.'}
                  </Text>
                </Animated.View>

                <Image
                  source={LANDSCAPE}
                  resizeMode="cover"
                  style={[styles.landscape, isCompact && styles.landscapeCompact]}
                  accessibilityIgnoresInvertColors
                />
              </>
            ) : null}
          </View>

          {/* LOWER WORLD: the ink panel holds the whole form. */}
          <View
            style={[
              styles.inkPanel,
              isKeyboardVisible && styles.inkPanelKeyboard,
              { paddingBottom: Math.max(insets.bottom + 12, 24) },
            ]}
          >
            <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel="Authentication mode">
              {(['signin', 'signup'] as const).map((value) => {
                const selected = tab === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => switchTab(value)}
                    disabled={loading}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[styles.segment, selected && styles.segmentSelected]}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {value === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldGroup}>
              {!isSignIn
                ? renderField(
                  'name',
                  'Name (optional)',
                  <UserRound size={18} color={fieldIconColor} strokeWidth={1.75} />,
                  name,
                  setName,
                  {
                    autoCapitalize: 'words',
                    autoComplete: 'name',
                    returnKeyType: 'next',
                    blurOnSubmit: false,
                    onSubmitEditing: () => emailInputRef.current?.focus(),
                  }
                )
                : null}

              {renderField(
                'email',
                'Email',
                <Mail size={18} color={fieldIconColor} strokeWidth={1.75} />,
                email,
                setEmail,
                {
                  inputRef: emailInputRef,
                  keyboardType: 'email-address',
                  autoComplete: 'email',
                  textContentType: 'emailAddress',
                  returnKeyType: 'next',
                  blurOnSubmit: false,
                  onSubmitEditing: () => passwordInputRef.current?.focus(),
                }
              )}

              {renderField(
                'password',
                'Password',
                <LockKeyhole size={18} color={fieldIconColor} strokeWidth={1.75} />,
                password,
                setPassword,
                {
                  inputRef: passwordInputRef,
                  autoComplete: isSignIn ? 'current-password' : 'new-password',
                  textContentType: isSignIn ? 'password' : 'newPassword',
                  secureTextEntry: true,
                  showToggle: true,
                  shown: showPassword,
                  onToggle: () => setShowPassword((current) => !current),
                  returnKeyType: 'go',
                  onSubmitEditing: handleSubmit,
                }
              )}
            </View>

            {isSignIn ? (
              <TouchableOpacity
                onPress={() => {
                  void handleForgotPassword();
                }}
                disabled={loading}
                style={styles.forgot}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.requirement}>At least 8 characters</Text>
            )}

            {error ? (
              <View style={styles.errorBanner}>
                <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.ctaWrap}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isSignIn ? 'Sign in' : 'Create account'}
              accessibilityState={{ busy: loading, disabled: loading }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[GOLD, GOLD_DEEP]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.ink.base} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>{ctaCopy}</Text>
                    <ArrowRight size={17} color={colors.ink.base} strokeWidth={2.4} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {isAppleAvailable || showGoogleSignIn ? (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialStack}>
                  {isAppleAvailable ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={14}
                      style={styles.appleButton}
                      onPress={() => {
                        void handleAppleSignIn();
                      }}
                    />
                  ) : null}

                  {showGoogleSignIn ? (
                    <TouchableOpacity
                      style={[styles.socialButton, loading ? styles.socialButtonDisabled : null]}
                      onPress={() => void handleGoogleSignIn()}
                      disabled={loading}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel="Continue with Google"
                    >
                      <GoogleIcon size={18} />
                      <Text style={styles.socialButtonText}>Continue with Google</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : null}

            <Text style={styles.footnote}>FREE ACCOUNT · YOUR ANCHORS STAY YOURS</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  keyboardAvoid: {
    flex: 1,
  },
  // Ink beneath the hero, so a tall screen or the keyboard never reveals cream under the panel.
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.ink.base,
  },

  /* HERO */
  hero: {
    backgroundColor: colors.canvas,
    overflow: 'hidden',
  },
  topRow: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // The back control is overlaid by the navigator on the left.
    justifyContent: 'flex-end',
  },
  contextualSwitch: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  contextualSwitchText: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#7A756D',
  },
  brandBlock: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  brandBlockCompact: {
    paddingTop: 0,
    paddingBottom: 4,
  },
  markFrame: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
    marginBottom: 8,
  },
  markGlow: {
    position: 'absolute',
    left: STAR_X - GLOW_SIZE / 2,
    top: STAR_Y - GLOW_SIZE / 2,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  mark: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
  },
  wordmark: {
    fontFamily: 'BricolageGrotesque-SemiBold',
    color: PAPER_INK,
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: 6.5,
    // Letter-spacing trails the last glyph; pad the start so the word stays optically centred.
    paddingLeft: 6.5,
  },
  descriptor: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.8,
    color: colors.text.secondary,
    marginTop: 4,
  },
  editorialDivider: {
    width: 24,
    height: 1,
    backgroundColor: '#C8C2B7',
    marginVertical: 8,
  },
  editorialCopy: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: '#34312D',
    textAlign: 'center',
  },
  landscape: {
    width: '100%',
    height: 135,
    marginTop: -6,
  },
  landscapeCompact: {
    height: 112,
  },
  heroKeyboard: {
    paddingBottom: 6,
  },
  inkPanelKeyboard: {
    marginTop: 0,
  },
  scrollContentKeyboard: {
    paddingBottom: 32,
  },

  /* INK PANEL */
  inkPanel: {
    flex: 1,
    backgroundColor: colors.ink.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.ink.hairline,
    marginTop: -26,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  segmented: {
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: colors.ink.hairline,
    flexDirection: 'row',
    padding: 3,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    borderColor: 'rgba(223, 192, 138, 0.85)',
    backgroundColor: 'rgba(223, 192, 138, 0.07)',
  },
  segmentText: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 11,
    letterSpacing: 0.8,
    color: INK_TEXT.secondary,
  },
  segmentTextSelected: {
    color: GOLD,
  },
  fieldGroup: {
    gap: 8,
    marginBottom: 6,
  },
  field: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  fieldFocused: {
    borderColor: 'rgba(223, 192, 138, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  fieldIcon: {
    width: 28,
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    height: 46,
    color: INK_TEXT.primary,
    fontFamily: typography.body,
    fontSize: 15,
  },
  fieldTrailing: {
    minWidth: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 4,
  },
  forgot: {
    alignSelf: 'flex-end',
    minHeight: 28,
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  forgotText: {
    fontFamily: typography.body,
    fontSize: 12.5,
    color: INK_TEXT.secondary,
  },
  requirement: {
    fontFamily: typography.body,
    fontSize: 12,
    color: INK_TEXT.tertiary,
    marginTop: 2,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  errorBanner: {
    backgroundColor: 'rgba(182, 59, 56, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(182, 59, 56, 0.32)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: '#FFAAA6',
  },
  ctaWrap: {
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  ctaText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 13.5,
    letterSpacing: 1.5,
    color: colors.ink.base,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.ink.hairlineStrong,
  },
  dividerText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: INK_TEXT.tertiary,
  },
  socialStack: {
    gap: 10,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  socialButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: colors.ink.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialButtonText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    color: INK_TEXT.primary,
  },
  footnote: {
    marginTop: 20,
    textAlign: 'center',
    fontFamily: typography.bodySemiBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: INK_TEXT.tertiary,
  },
});

export default LoginScreen;
