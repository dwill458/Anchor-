import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowRight, ChevronLeft, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { V2Screen } from '@/components/v2';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';
import { useAuthStore } from '@/stores/authStore';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { colors, spacing, typography, AnchorMotion } from '@/theme/v2';
import type { User } from '@/types';
import { GoogleIcon, AppleIcon } from './components/AuthSocialIcons';
import { AuthEngravedLinework } from './components/AuthEngravedLinework';

type Mode = 'signin' | 'create';

type Props = {
  initialMode?: Mode;
  saveProgress?: boolean;
  onBack: () => void;
  onSuccess?: (user: User) => void | Promise<void>;
};

function validationMessage(mode: Mode, email: string, password: string): string | null {
  if (!email.trim()) return 'Enter your email address.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
  if (!password) return 'Enter your password.';
  if (mode === 'create' && password.length < 8) return 'Password must be at least 8 characters.';
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
  if (message && message.length > 0 && !normalized.includes('firebase')) return message;
  return mode === 'signin' ? 'We could not sign you in. Try again.' : 'We could not create your account. Try again.';
}

export function V2AuthScreen({ initialMode = 'signin', saveProgress = false, onBack, onSuccess }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const signedInUser = useAuthStore((state) => state.user);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Segment width: total width minus padding (20 * 2) minus container inner padding (3 * 2) divided by 2
  const segmentContainerWidth = width - 40;
  const segmentWidth = Math.max(1, (segmentContainerWidth - 6) / 2);
  const indicator = useSharedValue(initialMode === 'create' ? 1 : 0);

  useEffect(() => {
    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => mounted && setAppleAvailable(available))
      .catch(() => mounted && setAppleAvailable(false));
    return () => { mounted = false; };
  }, []);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicator.value * segmentWidth }],
  }));

  const switchMode = (nextMode: Mode) => {
    Keyboard.dismiss();
    setError(null);
    setMode(nextMode);
    indicator.value = withTiming(nextMode === 'create' ? 1 : 0, {
      duration: AnchorMotion.duration.standard,
      easing: AnchorMotion.easing.standard,
    });
  };

  const complete = async (run: () => ReturnType<typeof AuthService.signInWithEmail>) => {
    setError(null);
    setLoading(true);
    try {
      const result = await run();
      await PostAuthFlowService.run({
        user: result.user,
        token: result.token,
        preserveCompletedOnboarding: result.user.hasCompletedOnboarding === true,
      });
      await onSuccess?.(result.user);
    } catch (cause) {
      const message = readableAuthError(cause, mode);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (saveProgress && signedInUser) {
      setError(null);
      setLoading(true);
      void Promise.resolve(onSuccess?.(signedInUser))
        .catch((cause) => setError(readableAuthError(cause, mode)))
        .finally(() => setLoading(false));
      return;
    }
    const validation = validationMessage(mode, email, password);
    if (validation) {
      setError(validation);
      return;
    }
    void complete(() => mode === 'signin'
      ? AuthService.signInWithEmail(email, password)
      : AuthService.signUpWithEmail(email, password, name));
  };

  const sendReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email first to reset your password.');
      emailRef.current?.focus();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      emailRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await AuthService.sendPasswordResetEmail(trimmedEmail);
      Alert.alert('Reset email sent', `If an Anchor account exists for ${trimmedEmail}, a reset link will arrive shortly.`);
    } catch (cause) {
      setError(readableAuthError(cause, 'signin'));
    } finally {
      setLoading(false);
    }
  };

  const socialSignIn = (provider: 'google' | 'apple') => {
    void complete(() => provider === 'google'
      ? AuthService.signInWithGoogle({ allowBackendCreate: mode === 'create' })
      : AuthService.signInWithApple({ allowBackendCreate: mode === 'create' }));
  };

  const openTerms = () => {
    void Linking.openURL('https://anchor-app.com/terms').catch(() => undefined);
  };

  const openPrivacy = () => {
    void Linking.openURL('https://anchor-app.com/privacy').catch(() => undefined);
  };

  const navigation = useNavigation<any>();

  const handleContinueToHome = () => {
    useAuthStore.getState?.()?.completeOnboarding?.();
    useFirstRunStore.getState?.()?.complete?.();
    navigation?.reset?.({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] });
  };

  const handleSignOut = async () => {
    setError(null);
    await AuthService.signOut().catch(() => undefined);
    await useAuthStore.getState?.()?.signOut?.();
  };

  const isCompact = height < 750;

  if (saveProgress && signedInUser) {
    return (
      <V2Screen scroll edges={['top']} testID="v2-auth-save-progress">
        <View style={{ flex: 1, minHeight: height - insets.top - insets.bottom - 60, justifyContent: 'center', paddingHorizontal: 28, backgroundColor: colors.background }}>
          <Text style={{ color: colors.text.primary, fontFamily: 'EBGaramond-Regular', fontSize: 38, textAlign: 'center', marginBottom: 12 }}>Save your progress.</Text>
          <Text style={{ color: colors.text.secondary, fontSize: 16, textAlign: 'center', marginBottom: 32 }}>Your account is ready. Finish saving your first Anchor and answers.</Text>
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity testID="v2-auth-save-retry" accessibilityRole="button" accessibilityLabel="Save my progress" disabled={loading} onPress={submit} style={styles.primaryCtaWrap}>
            <LinearGradient colors={['#DFC08A', '#C5A065']} style={styles.primaryGradient}>
              {loading ? <ActivityIndicator color="#121A22" /> : <Text style={styles.primaryCtaText}>SAVE MY PROGRESS</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            testID="v2-auth-continue-home"
            accessibilityRole="button"
            accessibilityLabel="Continue to Sanctuary"
            onPress={handleContinueToHome}
            style={{ marginTop: 16, alignItems: 'center', paddingVertical: 12 }}
          >
            <Text style={{ color: '#DFC08A', fontFamily: typography.utilityMedium.fontFamily, fontSize: 14 }}>
              Continue to Sanctuary
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="v2-auth-switch-account"
            accessibilityRole="button"
            accessibilityLabel="Use a different account"
            onPress={handleSignOut}
            style={{ marginTop: 4, alignItems: 'center', paddingVertical: 10 }}
          >
            <Text style={{ color: 'rgba(244, 246, 250, 0.45)', fontFamily: typography.utility.fontFamily, fontSize: 13 }}>
              Use a different account
            </Text>
          </TouchableOpacity>
        </View>
      </V2Screen>
    );
  }

  return (
    <View style={styles.root}>
      <V2Screen
        scroll
        keyboardAvoiding
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        edges={['top']}
        contentContainerStyle={styles.scrollContent}
        testID="v2-auth-screen"
      >
        {/* UPPER WORLD: Warm Paper Hero with Centered Brand & Landscape */}
        <View style={styles.heroContainer}>
          {/* Top Navigation Row: Back chevron & Contextual Auth label */}
          <View style={styles.topNavRow}>
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
            >
              <ChevronLeft size={24} color="#171717" strokeWidth={1.75} />
            </Pressable>

            <Pressable
              onPress={() => switchMode(mode === 'signin' ? 'create' : 'signin')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={mode === 'signin' ? 'Switch to Create account' : 'Switch to Sign in'}
              style={styles.contextualNavButton}
            >
              <Text style={styles.contextualNavText}>
                {mode === 'signin' ? 'CREATE ACCOUNT' : 'SIGN IN'}
              </Text>
            </Pressable>
          </View>

          {/* Centered Brand Block */}
          <Animated.View
            entering={FadeInDown.duration(AnchorMotion.duration.expressive)}
            style={[styles.brandBlock, isCompact && styles.brandBlockCompact]}
          >
            <Image
              source={require('@/assets/home/anchor-brand-mark.png')}
              resizeMode="contain"
              style={[styles.brandMark, isCompact && styles.brandMarkCompact]}
            />
            <Text style={styles.wordmark}>ANCHOR</Text>
            <Text style={styles.brandDescriptor}>VISUAL GOAL SETTING</Text>

            <View style={styles.editorialDivider} />

            <Text style={styles.editorialCopy}>
              {saveProgress ? 'Your work now exists.\nCreate an account to save it.' : mode === 'signin'
                ? 'Return to what matters.'
                : 'A stronger tomorrow\nstarts with what you create today.'}
            </Text>
          </Animated.View>

          {/* Engraved Mountain Valley Landscape Transition */}
          <View style={styles.landscapeWrapper} pointerEvents="none">
            <Image
              source={require('@/assets/images/auth-landscape-valley.png')}
              resizeMode="cover"
              style={[styles.landscapeImage, isCompact && styles.landscapeImageCompact]}
            />
          </View>
        </View>

        {/* LOWER WORLD: Deep Ink Auth Surface */}
        <Animated.View
          layout={LinearTransition.duration(AnchorMotion.duration.standard)}
          style={[styles.inkRegion, { paddingBottom: Math.max(insets.bottom + 10, 20) }]}
        >
          {/* Subtle Background Engraved Linework Watermark */}
          <AuthEngravedLinework width={width} height={150} />

          {/* Segmented Sign In / Create Account Control */}
          <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel="Authentication mode">
            <Animated.View style={[styles.segmentIndicator, indicatorStyle, { width: segmentWidth }]} />
            <Segment
              label="SIGN IN"
              selected={mode === 'signin'}
              onPress={() => switchMode('signin')}
            />
            <Segment
              label="CREATE ACCOUNT"
              selected={mode === 'create'}
              onPress={() => switchMode('create')}
            />
          </View>

          {/* Form Fields */}
          {mode === 'create' ? (
            <Animated.View
              entering={FadeInDown.duration(200)}
              exiting={FadeOutUp.duration(160)}
              style={styles.fieldGroup}
            >
              <Field
                icon={<UserRound size={18} color="rgba(244, 246, 250, 0.42)" strokeWidth={1.75} />}
                label="Name (optional)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </Animated.View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Field
              ref={emailRef}
              icon={<Mail size={18} color="rgba(244, 246, 250, 0.42)" strokeWidth={1.75} />}
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <Field
              ref={passwordRef}
              icon={<LockKeyhole size={18} color="rgba(244, 246, 250, 0.42)" strokeWidth={1.75} />}
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              secureTextEntry={!passwordVisible}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              textContentType={mode === 'signin' ? 'password' : 'newPassword'}
              returnKeyType="go"
              onSubmitEditing={submit}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  accessibilityState={{ selected: passwordVisible }}
                  hitSlop={10}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  style={styles.passwordToggle}
                >
                  {passwordVisible ? (
                    <EyeOff size={19} color="rgba(244, 246, 250, 0.45)" strokeWidth={1.75} />
                  ) : (
                    <Eye size={19} color="rgba(244, 246, 250, 0.45)" strokeWidth={1.75} />
                  )}
                </Pressable>
              }
            />
          </View>

          {/* Under-field Contextual Copy */}
          {mode === 'create' ? (
            <Text style={styles.requirement}>At least 8 characters</Text>
          ) : (
            <Pressable
              disabled={loading}
              onPress={() => void sendReset()}
              accessibilityRole="button"
              style={styles.forgot}
              hitSlop={8}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          {/* Error Banner */}
          {error ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              style={styles.errorBanner}
            >
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                style={styles.errorText}
              >
                {error}
              </Text>
            </Animated.View>
          ) : null}

          {/* Primary Warm-Gold CTA */}
          <TouchableOpacity
            testID="v2-auth-submit"
            disabled={loading}
            onPress={submit}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
            accessibilityState={{ busy: loading, disabled: loading }}
            style={styles.primaryCtaWrap}
          >
            <LinearGradient
              pointerEvents="none"
              colors={['#DFC08A', '#C5A065']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color="#121A22"
                  testID="v2-auth-submit-loading"
                />
              ) : (
                <>
                  <Text style={styles.primaryCtaText}>
                    {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                  </Text>
                  <ArrowRight size={17} color="#121A22" strokeWidth={2.4} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Balanced Side-by-Side Social Auth Row */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              disabled={loading}
              activeOpacity={0.75}
              onPress={() => socialSignIn('google')}
              style={styles.socialButton}
            >
              <GoogleIcon size={18} />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
              disabled={loading}
              activeOpacity={0.75}
              onPress={() => socialSignIn('apple')}
              style={styles.socialButton}
            >
              <AppleIcon size={18} color="#FFFFFF" />
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Quiet Legal Copy */}
          <Text style={styles.legal}>
            By continuing, you agree to our{'\n'}
            <Text onPress={openTerms} style={styles.legalLink}>Terms</Text> and{' '}
            <Text onPress={openPrivacy} style={styles.legalLink}>Privacy Policy</Text>.
          </Text>
        </Animated.View>
      </V2Screen>
    </View>
  );
}

const Field = React.forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput> & {
    icon: React.ReactNode;
    label: string;
    trailing?: React.ReactNode;
  }
>(function Field({ icon, label, trailing, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <View style={styles.fieldIcon}>{icon}</View>
      <TextInput
        ref={ref}
        placeholder={label}
        placeholderTextColor="rgba(244, 246, 250, 0.42)"
        accessibilityLabel={label}
        style={styles.fieldInput}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        {...props}
      />
      {trailing ? <View style={styles.fieldTrailing}>{trailing}</View> : null}
    </View>
  );
});

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.segment}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    flexGrow: 1,
    backgroundColor: colors.ink.base,
  },

  /* HERO REGION */
  heroContainer: {
    backgroundColor: colors.canvas,
    overflow: 'hidden',
    position: 'relative',
    paddingTop: spacing[2],
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  contextualNavButton: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  contextualNavText: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#7A756D',
    textTransform: 'uppercase',
  },

  brandBlock: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  brandBlockCompact: {
    paddingTop: 0,
    paddingBottom: 6,
  },
  brandMark: {
    width: 62,
    height: 80,
    marginBottom: 6,
  },
  brandMarkCompact: {
    width: 52,
    height: 66,
    marginBottom: 4,
  },
  wordmark: {
    fontFamily: 'BricolageGrotesque-SemiBold',
    color: '#171717',
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: 6.5,
  },
  brandDescriptor: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 1.8,
    color: '#6C6861',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  editorialDivider: {
    width: 24,
    height: 1,
    backgroundColor: '#C8C2B7',
    marginVertical: 6,
  },
  editorialCopy: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 14.5,
    lineHeight: 19,
    color: '#34312D',
    textAlign: 'center',
  },

  landscapeWrapper: {
    width: '100%',
    height: 135,
    marginTop: -8,
    overflow: 'hidden',
  },
  landscapeImage: {
    width: '100%',
    height: 135,
  },
  landscapeImageCompact: {
    height: 118,
  },

  /* DARK AUTH PANEL */
  inkRegion: {
    flex: 1,
    backgroundColor: colors.ink.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 0,
    marginTop: -26,
    paddingHorizontal: 20,
    paddingTop: 16,
    position: 'relative',
    overflow: 'hidden',
  },

  /* SEGMENTED CONTROL */
  segmented: {
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    padding: 3,
    position: 'relative',
    marginBottom: 12,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 11,
    letterSpacing: 0.8,
    color: 'rgba(244, 246, 250, 0.45)',
    textTransform: 'uppercase',
  },
  segmentTextSelected: {
    color: '#DFC08A',
  },

  /* FORM FIELDS */
  fieldGroup: {
    gap: 8,
    marginBottom: 8,
  },
  field: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  fieldFocused: {
    borderColor: 'rgba(212, 175, 55, 0.42)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  fieldIcon: {
    width: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    height: 46,
    color: '#F4F6FA',
    fontSize: 15,
  },
  fieldTrailing: {
    minWidth: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  passwordToggle: {
    padding: 4,
  },

  requirement: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: 'rgba(244, 246, 250, 0.45)',
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  forgot: {
    alignSelf: 'flex-end',
    minHeight: 28,
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  forgotText: {
    fontFamily: typography.utility.fontFamily,
    fontSize: 12.5,
    color: 'rgba(244, 246, 250, 0.55)',
  },

  /* ERROR BANNER */
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
    fontFamily: typography.bodySM.fontFamily,
    fontSize: 13,
    lineHeight: 18,
    color: '#FFAAA6',
  },

  /* PRIMARY CTA */
  primaryCtaWrap: {
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 2,
  },
  primaryCtaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  primaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryCtaText: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#121A22',
    textTransform: 'uppercase',
  },

  /* DIVIDER */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 11,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  dividerText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: 'rgba(244, 246, 250, 0.45)',
  },

  /* SOCIAL AUTH */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  socialButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  socialButtonText: {
    fontFamily: typography.utilityMedium.fontFamily,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#F4F6FA',
  },

  /* LEGAL */
  legal: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(244, 246, 250, 0.45)',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  legalLink: {
    color: '#F4F6FA',
    textDecorationLine: 'underline',
  },
});
