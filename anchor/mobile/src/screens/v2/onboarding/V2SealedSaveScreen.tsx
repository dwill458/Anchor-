import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, ChevronDown, ChevronLeft, Eye, EyeOff, Mail } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { computeFlowLayout } from '@/screens/create/flow/flowLayout';
import { MEDALLION } from '@/screens/create/flow/sealMath';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { V2PaywallScreen, type V2PaywallEntitlementResult } from '@/screens/v2/paywall';
import { logger } from '@/utils/logger';
import { colors, typography } from '@/theme/v2';
import type { User } from '@/types';
import { GoogleIcon, AppleIcon } from '@/screens/v2/auth/components/AuthSocialIcons';
import { OnboardingAnalytics, type AuthMode, type AuthMethod, type ValidationCode } from '@/services/v2/onboardingAnalytics';
import { playCreationSound } from '@/services/CreationSounds';

type Mode = 'signin' | 'create';
export type SaveKind = 'account' | 'guest';

type Props = {
  /** Runs once an account exists: uploads the Anchor and binds the first-run draft. Throws if it could not. */
  onAccountReady: (user: User) => void | Promise<void>;
  /** The person chose to keep the Anchor on this device only. */
  onContinueWithout: () => void;
  /** "Continue to Home" on the confirmation. */
  onContinue: (kind: SaveKind) => void;
  onBack: () => void;
  /** Start on the confirmation, e.g. a relaunch after the account was already saved. */
  initialSaved?: SaveKind | null;
};

const INK = '#121A22';
const GOLD = '#B8935A';
const SERIF = 'EBGaramond-Regular';
const SERIF_ITALIC = 'EBGaramond-Italic';

/** The coin's resting size and the seal's, so the screen can start from exactly where the seal ended. */
const REST_COIN = 168;
const COMPACT_COIN = 104;
const INTRO_MS = 720;

function validationMessage(email: string, password: string, mode: Mode): string | null {
  if (!email.trim()) return 'Enter your email address.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
  if (!password) return mode === 'signin' ? 'Enter your password.' : 'Create a password.';
  if (mode === 'create' && password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

function validationCode(email: string, password: string, mode: Mode): ValidationCode | null {
  if (!email.trim()) return 'email_missing';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'email_invalid';
  if (!password) return 'password_missing';
  if (mode === 'create' && password.length < 8) return 'password_short';
  return null;
}

function readableAuthError(error: unknown, mode: Mode): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalized = message.toLowerCase();
  if (normalized.includes('already') && normalized.includes('email')) return 'An account already exists with this email.';
  if (normalized.includes('wrong-password') || normalized.includes('incorrect') || normalized.includes('credential')) return "That email and password don't match.";
  if (normalized.includes('user-not-found') || normalized.includes('no user')) return 'No account found with this email.';
  if (normalized.includes('invalid-email')) return 'Enter a valid email address.';
  if (normalized.includes('weak') || normalized.includes('at least 8')) return 'Password must be at least 8 characters.';
  if (normalized.includes('network')) return 'Check your connection and try again.';
  if (normalized.includes('cancel')) return '';
  if (message && !normalized.includes('firebase')) return message;
  return mode === 'signin' ? 'We could not sign you in. Try again.' : 'We could not create your account. Try again.';
}

/**
 * The first screen after the seal. The Anchor is already safe on this device; an account is an
 * upgrade (backup and sync), never a gate. The coin starts exactly where the seal left it and
 * settles upward while the options arrive, so seal to save reads as one moment.
 */
export function V2SealedSaveScreen({ onAccountReady, onContinueWithout, onContinue, onBack, initialSaved = null }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const signedInUser = useAuthStore((state) => state.user);
  const pendingTempId = useAuthStore((state) => state.pendingFirstAnchorDraft?.tempAnchorId);
  const canRetryPendingSave = useAuthStore((state) => Boolean(
    state.pendingFirstAnchorDraft?.createAttempted || state.pendingFirstAnchorDraft?.backendAnchorId,
  ));
  const anchor = useAnchorStore((state) => state.anchors.find((item) => item.id === pendingTempId) ?? state.anchors[0]);
  const hasActiveEntitlement = useSubscriptionStore(
    (state) =>
      state.hasActiveEntitlement ||
      state.remoteCompedAccess ||
      state.legacyMigrationAccess,
  );

  const [saved, setSaved] = useState<SaveKind | null>(initialSaved);
  const [authedUser, setAuthedUser] = useState<User | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const retryAttemptRef = useRef(0);
  const sealedSoundPlayedRef = useRef(false);

  const activeUser = signedInUser ?? authedUser;
  const hasUserEntitlement = Boolean(
    hasActiveEntitlement ||
      activeUser?.isComped === true ||
      activeUser?.legacyMigrationAccess === true ||
      (activeUser?.subscriptionStatus && activeUser.subscriptionStatus !== 'free'),
  );
  const isLockedFreeUser = Boolean(
    activeUser &&
    !hasUserEntitlement &&
    (activeUser.freeAnchorConsumed || (activeUser.totalAnchorsCreated ?? 0) >= 1)
  );
  const isSubscriptionRequired = requiresSubscription || (isLockedFreeUser && !canRetryPendingSave);

  useEffect(() => {
    if (!anchor || sealedSoundPlayedRef.current) return;
    sealedSoundPlayedRef.current = true;
    playCreationSound('onboardingSealed');
  }, [anchor]);

  useEffect(() => {
    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => mounted && setAppleAvailable(available))
      .catch(() => mounted && setAppleAvailable(false));
    return () => { mounted = false; };
  }, []);

  // ---- the coin: seal position -> resting position, then compact while the email form is open ----
  const layout = useMemo(() => computeFlowLayout(width, height), [width, height]);
  const coinSize = Math.min(REST_COIN, width * 0.46);
  const compactSize = Math.min(COMPACT_COIN, coinSize * 0.62);
  const coinTop = insets.top + 56;
  const sealSize = MEDALLION.size * layout.scale;
  const sealCenterY = layout.offsetY + MEDALLION.centerY * layout.scale;

  const intro = useSharedValue(reduceMotion || initialSaved ? 1 : 0);
  const compact = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || initialSaved) return;
    intro.value = withDelay(180, withTiming(1, { duration: INTRO_MS, easing: Easing.bezier(0.22, 0.61, 0.36, 1) }));
  }, [initialSaved, intro, reduceMotion]);
  useEffect(() => {
    compact.value = withTiming(emailOpen ? 1 : 0, { duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.cubic) });
  }, [compact, emailOpen, reduceMotion]);

  const coinWrapStyle = useAnimatedStyle(() => ({
    height: interpolate(compact.value, [0, 1], [coinSize, compactSize]),
  }));
  const coinStyle = useAnimatedStyle(() => {
    const restScale = interpolate(compact.value, [0, 1], [1, compactSize / coinSize]);
    const fromScale = sealSize / coinSize;
    const scale = interpolate(intro.value, [0, 1], [fromScale, restScale]);
    // The coin is laid out at its resting centre; start from the seal's centre.
    const restCenterY = coinTop + interpolate(compact.value, [0, 1], [coinSize, compactSize]) / 2;
    const dy = interpolate(intro.value, [0, 1], [sealCenterY - restCenterY, 0]);
    return { transform: [{ translateY: dy }, { scale }] };
  });

  // ---- account ----
  const finish = async (run: () => ReturnType<typeof AuthService.signInWithEmail>, method: AuthMethod) => {
    setError(null);
    setLoading(true);
    try {
      let result: Awaited<ReturnType<typeof run>>;
      try {
        OnboardingAnalytics.auth.started('onboarding_save', method, mode as AuthMode);
        result = await run();
        setAuthedUser(result.user);
        OnboardingAnalytics.auth.succeeded('onboarding_save', method, mode as AuthMode, result.user.hasCompletedOnboarding === true);
      } catch (cause) {
        const code = OnboardingAnalytics.classifyAuthError(cause);
        if (code === 'cancelled') OnboardingAnalytics.auth.cancelled('onboarding_save', method, mode as AuthMode);
        else OnboardingAnalytics.auth.failed('onboarding_save', method, mode as AuthMode, 'provider', code);
        const message = readableAuthError(cause, mode);
        if (message) setError(message);
        return;
      }
      try {
        await PostAuthFlowService.run({
          user: result.user,
          token: result.token,
          preserveCompletedOnboarding: result.user.hasCompletedOnboarding === true,
        });
        await onAccountReady(result.user);
        Keyboard.dismiss();
        setSaved('account');
      } catch (cause) {
        const isFreeLocked =
          (cause instanceof Error && cause.message.includes('CREATE_ANCHOR_FREE_LOCKED')) ||
          (typeof cause === 'string' && cause.includes('CREATE_ANCHOR_FREE_LOCKED')) ||
          useAuthStore.getState().pendingFirstAnchorError === 'CREATE_ANCHOR_FREE_LOCKED';

        if (isFreeLocked) {
          setRequiresSubscription(true);
          setShowPaywall(true);
          setError('This account already used its free Anchor. Subscribe to Anchor Pro to save this Anchor.');
          return;
        }

        OnboardingAnalytics.auth.saveFailed('onboarding_save', OnboardingAnalytics.classifyAuthError(cause));
        const message = readableAuthError(cause, mode);
        if (message) setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = () => {
    const problem = validationMessage(email, password, mode);
    if (problem) {
      OnboardingAnalytics.auth.failed('onboarding_save', 'email', mode as AuthMode, 'validation', validationCode(email, password, mode)!);
      setError(problem);
      return;
    }
    void finish(() => mode === 'signin'
      ? AuthService.signInWithEmail(email.trim(), password)
      : AuthService.signUpWithEmail(email.trim(), password), 'email');
  };

  const social = (provider: 'google' | 'apple') => void finish(() => provider === 'google'
    ? AuthService.signInWithGoogle({ allowBackendCreate: mode === 'create' })
    : AuthService.signInWithApple({ allowBackendCreate: mode === 'create' }), provider);

  // The account exists but the Anchor has not finished saving (a dropped connection, a relaunch).
  const retrySave = async () => {
    const userToSave = activeUser;
    if (!userToSave) return;
    retryAttemptRef.current += 1;
    OnboardingAnalytics.auth.saveRetry(retryAttemptRef.current);
    setError(null);
    setLoading(true);
    try {
      await onAccountReady(userToSave);
      setSaved('account');
    } catch (cause) {
      const isFreeLocked =
        (cause instanceof Error && cause.message.includes('CREATE_ANCHOR_FREE_LOCKED')) ||
        (typeof cause === 'string' && cause.includes('CREATE_ANCHOR_FREE_LOCKED')) ||
        useAuthStore.getState().pendingFirstAnchorError === 'CREATE_ANCHOR_FREE_LOCKED';

      if (isFreeLocked) {
        setRequiresSubscription(true);
        setShowPaywall(true);
        setError('This account already used its free Anchor. Subscribe to Anchor Pro to save this Anchor.');
      } else {
        OnboardingAnalytics.auth.saveFailed('onboarding_save', OnboardingAnalytics.classifyAuthError(cause));
        setError(readableAuthError(cause, 'create') || 'Your Anchor has not finished saving. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const discardAnchorForever = () => {
    const anchorStore = useAnchorStore.getState();
    if (pendingTempId) {
      anchorStore.removeAnchor(pendingTempId);
    }
    useAuthStore.getState().clearPendingFirstAnchorState();
    onContinue('account');
  };

  const handlePaywallEntitled = async (_result: V2PaywallEntitlementResult) => {
    setShowPaywall(false);
    setRequiresSubscription(false);
    setError(null);
    setLoading(true);
    try {
      const userToSave = useAuthStore.getState().user ?? activeUser;
      if (userToSave) {
        await onAccountReady(userToSave);
        setSaved('account');
      }
    } catch (saveError) {
      logger.warn('[V2SealedSaveScreen] Failed to save anchor after entitlement', saveError);
      setError('Subscription verified, but failed to save Anchor. Tap finish saving to retry.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaywallDismiss = () => {
    setShowPaywall(false);
  };

  const keepOnDevice = async () => {
    OnboardingAnalytics.auth.guestChosen();
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      await useAnchorStore.getState().flushPersistence();
      onContinueWithout();
      setSaved('guest');
    } catch (saveError) {
      logger.warn('[V2SealedSaveScreen] Local Anchor save failed', saveError);
      setError('Your Anchor could not be saved on this device. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEmail = (open: boolean, nextMode?: Mode) => {
    setError(null);
    if (nextMode) setMode(nextMode);
    if (open && !emailOpen) OnboardingAnalytics.auth.emailFormOpened('onboarding_save', (nextMode ?? mode) as AuthMode);
    setEmailOpen(open);
  };

  const enter = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(320));
  const intention = anchor?.intentionText?.trim();
  const confirmed = saved !== null;

  return (
    <View style={styles.root} testID="v2-sealed-save">
      <View style={styles.landscape} pointerEvents="none">
        <Image
          source={require('@/assets/images/auth-landscape-valley.png')}
          resizeMode="cover"
          style={{ width: '100%', height: Math.round(height * 0.3) }}
          accessible={false}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: coinTop, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.coinWrap, { width: coinSize }, coinWrapStyle]}>
          <Animated.View style={[{ width: coinSize, height: coinSize, alignSelf: 'center' }, coinStyle]}>
            {anchor ? (
              <CircularAnchorRenderer
                {...anchorRenderProps(anchor)}
                size={coinSize}
                appearance="paper"
                accessibilityLabel="Your sealed Anchor"
                testID="v2-sealed-save-coin"
              />
            ) : null}
            {confirmed ? (
              <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(260).delay(120)} style={styles.badge}>
                <Check size={20} color="#FBF9F4" strokeWidth={3} />
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>

        {confirmed ? (
          <Animated.View key="saved" entering={reduceMotion ? undefined : FadeIn.duration(280)} exiting={FadeOut.duration(120)} style={styles.block}>
            <Text style={styles.title} accessibilityRole="header">PROGRESS SAVED</Text>
            <Text style={styles.body}>
              {saved === 'account'
                ? 'Your Anchor is saved to your account\nand ready whenever you are.'
                : 'Your Anchor is saved on this device\nand ready whenever you are.'}
            </Text>
            <Pressable
              testID="v2-sealed-save-home"
              accessibilityRole="button"
              accessibilityLabel="Continue to Home"
              onPress={() => onContinue(saved)}
              style={({ pressed }) => [styles.primary, styles.homeButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Continue to Home</Text>
              <ArrowRight size={18} color="#FBF9F4" strokeWidth={2} />
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View key="options" exiting={FadeOut.duration(120)} style={styles.block}>
            <Animated.View entering={enter(300)} style={styles.centered}>
              <Text style={[styles.title, emailOpen && styles.titleCompact]} accessibilityRole="header">
                YOUR ANCHOR{'\n'}IS SEALED
              </Text>
              {intention ? (
                <Text style={styles.intention} numberOfLines={2}>{'“'}{intention}{'”'}</Text>
              ) : null}
              <View style={styles.rule} />
            </Animated.View>

            <Animated.View entering={enter(420)} style={styles.centered}>
              <Text style={styles.heading}>
                {isSubscriptionRequired ? 'Anchor Pro required' : 'Save your progress'}
              </Text>
              <Text style={styles.body}>
                {isSubscriptionRequired
                  ? 'This account already used its free Anchor.\nSubscribe to Pro to save this Anchor,\nor discard it to continue.'
                  : 'Create a free account to keep your\nAnchor, practice history, and progress\nwith you.'}
              </Text>
            </Animated.View>

            {activeUser ? (
              <Animated.View entering={enter(480)} style={styles.stack}>
                {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                {isSubscriptionRequired ? (
                  <>
                    <Pressable
                      testID="v2-sealed-save-unlock-pro"
                      accessibilityRole="button"
                      accessibilityLabel="Unlock Anchor Pro to save"
                      disabled={loading}
                      onPress={() => setShowPaywall(true)}
                      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                    >
                      <Text style={styles.primaryText}>Unlock Anchor Pro to save</Text>
                      <ArrowRight size={18} color="#FBF9F4" strokeWidth={2} />
                    </Pressable>
                    <Pressable
                      testID="v2-sealed-save-discard"
                      accessibilityRole="button"
                      accessibilityLabel="Discard Anchor & Continue"
                      disabled={loading}
                      onPress={discardAnchorForever}
                      style={({ pressed }) => [styles.button, styles.outline, pressed && styles.pressed]}
                    >
                      <Text style={styles.outlineText}>Discard Anchor & Continue</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    testID="v2-sealed-save-retry"
                    accessibilityRole="button"
                    accessibilityLabel="Finish saving my Anchor"
                    disabled={loading}
                    onPress={() => void retrySave()}
                    style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                  >
                    {loading ? <ActivityIndicator color="#FBF9F4" /> : <Text style={styles.primaryText}>Finish saving</Text>}
                  </Pressable>
                )}
                <Pressable
                  testID="v2-sealed-save-switch-account"
                  accessibilityRole="button"
                  accessibilityLabel="Use a different account"
                  onPress={async () => {
                    await AuthService.signOut().catch(() => undefined);
                    await useAuthStore.getState().signOut?.();
                    setAuthedUser(null);
                    setRequiresSubscription(false);
                    setError(null);
                  }}
                  style={styles.quiet}
                >
                  <Text style={styles.quietText}>Use a different account</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={enter(520)} style={styles.stack}>
                <Pressable
                  testID="v2-sealed-save-google"
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  disabled={loading}
                  onPress={() => social('google')}
                  style={({ pressed }) => [styles.button, styles.light, pressed && styles.pressed]}
                >
                  <GoogleIcon size={20} />
                  <Text style={styles.lightText}>Continue with Google</Text>
                </Pressable>
                {appleAvailable ? (
                  <Pressable
                    testID="v2-sealed-save-apple"
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                    disabled={loading}
                    onPress={() => social('apple')}
                    style={({ pressed }) => [styles.button, styles.dark, pressed && styles.pressed]}
                  >
                    <AppleIcon size={20} color="#FFFFFF" />
                    <Text style={styles.darkText}>Continue with Apple</Text>
                  </Pressable>
                ) : null}

                <View style={styles.or}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>

                {emailOpen ? (
                  <Animated.View entering={FadeIn.duration(180)} style={styles.panel} testID="v2-sealed-save-email-panel">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Collapse email sign up"
                      onPress={() => toggleEmail(false)}
                      style={styles.panelHeader}
                    >
                      <Mail size={19} color={INK} strokeWidth={1.6} />
                      <Text style={styles.panelTitle}>Continue with email</Text>
                      <ChevronDown size={18} color={INK} strokeWidth={1.8} style={styles.chevronOpen} />
                    </Pressable>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      testID="v2-sealed-save-email"
                      accessibilityLabel="Email"
                      value={email}
                      onChangeText={(value) => { setEmail(value); setError(null); }}
                      placeholder="you@example.com"
                      placeholderTextColor="#9A958C"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      style={styles.input}
                    />
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        ref={passwordRef}
                        testID="v2-sealed-save-password"
                        accessibilityLabel="Password"
                        value={password}
                        onChangeText={(value) => { setPassword(value); setError(null); }}
                        placeholder={mode === 'create' ? 'Create a password' : 'Your password'}
                        placeholderTextColor="#9A958C"
                        secureTextEntry={!passwordVisible}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                        textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                        returnKeyType="go"
                        onSubmitEditing={submitEmail}
                        style={[styles.input, styles.inputBare]}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                        hitSlop={10}
                        onPress={() => setPasswordVisible((visible) => !visible)}
                        style={styles.eye}
                      >
                        {passwordVisible ? <EyeOff size={19} color="#6C6861" strokeWidth={1.6} /> : <Eye size={19} color="#6C6861" strokeWidth={1.6} />}
                      </Pressable>
                    </View>
                    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                    <Pressable
                      testID="v2-sealed-save-submit"
                      accessibilityRole="button"
                      accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
                      disabled={loading}
                      onPress={submitEmail}
                      style={({ pressed }) => [styles.primary, styles.submit, pressed && styles.pressed]}
                    >
                      {loading ? <ActivityIndicator color="#FBF9F4" /> : <Text style={styles.primaryText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
                    </Pressable>
                  </Animated.View>
                ) : (
                  <Pressable
                    testID="v2-sealed-save-email-toggle"
                    accessibilityRole="button"
                    accessibilityLabel="Continue with email"
                    disabled={loading}
                    onPress={() => toggleEmail(true)}
                    style={({ pressed }) => [styles.button, styles.outline, pressed && styles.pressed]}
                  >
                    <Mail size={19} color={INK} strokeWidth={1.6} />
                    <Text style={styles.outlineText}>Continue with email</Text>
                  </Pressable>
                )}

                {error && !emailOpen ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

                <Pressable
                  testID="v2-sealed-save-skip"
                  accessibilityRole="button"
                  accessibilityLabel="Continue without an account"
                  disabled={loading}
                  onPress={keepOnDevice}
                  hitSlop={8}
                  style={styles.quiet}
                >
                  <Text style={styles.quietText}>Continue without an account</Text>
                </Pressable>

                <Pressable
                  testID="v2-sealed-save-signin"
                  accessibilityRole="button"
                  accessibilityLabel={mode === 'signin' ? 'Create a new account instead' : 'Already have an account? Sign in'}
                  disabled={loading}
                  onPress={() => toggleEmail(true, mode === 'signin' ? 'create' : 'signin')}
                  hitSlop={8}
                  style={styles.quiet}
                >
                  <Text style={styles.signIn}>
                    {mode === 'signin' ? 'New here? ' : 'Already have an account? '}
                    <Text style={styles.signInLink}>{mode === 'signin' ? 'Create account' : 'Sign in'}</Text>
                  </Text>
                </Pressable>

                <Text style={styles.legal}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.legalLink} onPress={() => void Linking.openURL('https://anchor-app.com/terms').catch(() => undefined)}>Terms</Text>
                  {' '}and{' '}
                  <Text style={styles.legalLink} onPress={() => void Linking.openURL('https://anchor-app.com/privacy').catch(() => undefined)}>Privacy Policy</Text>.
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {!confirmed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={onBack}
          style={[styles.back, { top: insets.top + 8 }]}
        >
          <ChevronLeft size={24} color="#171717" strokeWidth={1.75} />
        </Pressable>
      ) : null}

      {showPaywall ? (
        <View style={[StyleSheet.absoluteFill, styles.paywallContainer]} testID="v2-sealed-save-paywall-modal">
          <V2PaywallScreen
            context="SECOND_ANCHOR"
            onEntitled={handlePaywallEntitled}
            onDismiss={handlePaywallDismiss}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  paywallContainer: { zIndex: 100, backgroundColor: colors.canvas },
  landscape: { position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.85 },
  content: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'stretch' },
  coinWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GOLD,
    borderWidth: 3,
    borderColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { marginTop: 18 },
  centered: { alignItems: 'center' },
  title: {
    fontFamily: SERIF,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: 1,
    color: '#171717',
    textAlign: 'center',
  },
  titleCompact: { fontSize: 26, lineHeight: 30 },
  intention: {
    fontFamily: SERIF_ITALIC,
    fontSize: 19,
    lineHeight: 25,
    color: '#34312D',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  rule: { width: 26, height: 1, backgroundColor: GOLD, marginTop: 14, marginBottom: 16 },
  heading: { fontFamily: SERIF, fontSize: 23, lineHeight: 28, color: '#171717', textAlign: 'center', marginBottom: 8 },
  body: {
    fontFamily: typography.utility.fontFamily,
    fontSize: 14.5,
    lineHeight: 21,
    color: '#5B574F',
    textAlign: 'center',
  },
  stack: { marginTop: 22, gap: 12 },
  button: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  light: { backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  lightText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 15.5, color: '#171717' },
  dark: { backgroundColor: '#050505' },
  darkText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 15.5, color: '#FFFFFF' },
  outline: { borderWidth: 1, borderColor: '#B9B2A6', backgroundColor: 'rgba(255,255,255,0.35)' },
  outlineText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 15.5, color: INK },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  or: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#B9B2A6' },
  orText: { fontFamily: typography.utility.fontFamily, fontSize: 13.5, color: '#6C6861' },
  panel: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    padding: 14,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 40 },
  panelTitle: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 15.5, color: INK },
  chevronOpen: { position: 'absolute', right: 2 },
  label: { fontFamily: typography.utilityMedium.fontFamily, fontSize: 13.5, color: '#171717', marginTop: 10, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: '#FBF9F4',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#171717',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: '#FBF9F4',
  },
  inputBare: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
  eye: { paddingHorizontal: 14, height: 48, justifyContent: 'center' },
  primary: {
    height: 52,
    borderRadius: 14,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 15.5, color: '#FBF9F4' },
  submit: { marginTop: 14 },
  homeButton: { marginTop: 26, justifyContent: 'center', paddingHorizontal: 20 },
  error: { fontFamily: typography.utility.fontFamily, fontSize: 13, lineHeight: 18, color: colors.semantic.error, textAlign: 'center', marginTop: 10 },
  quiet: { alignItems: 'center', paddingVertical: 8 },
  quietText: { fontFamily: typography.utility.fontFamily, fontSize: 15, color: '#3F3B35' },
  signIn: { fontFamily: typography.utility.fontFamily, fontSize: 13.5, color: '#6C6861' },
  signInLink: { fontFamily: typography.utilitySemibold.fontFamily, color: INK, textDecorationLine: 'underline' },
  legal: { fontFamily: typography.caption.fontFamily, fontSize: 11.5, lineHeight: 17, color: '#7A756D', textAlign: 'center', marginTop: 2 },
  legalLink: { color: '#3F3B35', textDecorationLine: 'underline' },
  back: { position: 'absolute', left: 14, width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 4 },
});
