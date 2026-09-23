import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { V2Button, V2Screen } from '@/components/v2';
import { AuthService } from '@/services/AuthService';
import PostAuthFlowService from '@/services/PostAuthFlowService';
import { colors, spacing, typography, AnchorMotion } from '@/theme/v2';

type Mode = 'signin' | 'create';

type Props = {
  initialMode?: Mode;
  onBack: () => void;
};

function validationMessage(mode: Mode, email: string, password: string): string | null {
  if (!email.trim()) return 'Enter your email address.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
  if (!password) return 'Enter your password.';
  if (mode === 'create' && password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

function readableAuthError(error: unknown, mode: Mode): string {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (normalized.includes('already') && normalized.includes('email')) return 'An account already exists with this email.';
  if (normalized.includes('wrong-password') || normalized.includes('incorrect') || normalized.includes('credential')) return "That email and password don't match.";
  if (normalized.includes('invalid-email')) return 'Enter a valid email address.';
  if (normalized.includes('weak') || normalized.includes('at least 8')) return 'Password must be at least 8 characters.';
  if (normalized.includes('network')) return 'Check your connection and try again.';
  if (normalized.includes('cancel')) return '';
  return mode === 'signin' ? 'We could not sign you in. Try again.' : 'We could not create your account. Try again.';
}

/**
 * One real authentication surface for both existing and new accounts. The
 * services below own Firebase, provider credential handling, backend sync,
 * account linking, secure storage, and RevenueCat identity; this screen owns
 * only presentation and local form state.
 */
export function V2AuthScreen({ initialMode = 'signin', onBack }: Props) {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const indicator = useSharedValue(initialMode === 'create' ? 1 : 0);
  const segmentWidth = Math.max(1, (width - spacing[6] * 2) / 2);
  const compactHero = height < 700;

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
      // AnchorV2Navigator observes trusted auth/onboarding state and resets to
      // Home only for existing completed accounts. New accounts remain in the
      // first-run journey; neither path starts a trial.
    } catch (cause) {
      const message = readableAuthError(cause, mode);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
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

  return (
    <View style={styles.root}>
      <V2Screen
        scroll
        keyboardAvoiding
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        testID="v2-auth-screen"
      >
        <View style={[styles.hero, compactHero && styles.heroCompact]}>
          <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backButton}>
            <ArrowLeft size={22} color={colors.text.primary} />
          </Pressable>
          <Animated.View entering={FadeInDown.duration(AnchorMotion.duration.expressive)} style={styles.brandBlock}>
            <Image source={require('@/assets/home/anchor-brand-mark.png')} resizeMode="contain" style={[styles.brandMark, compactHero && styles.brandMarkCompact]} />
            <Text style={styles.wordmark}>ANCHOR</Text>
            <Text style={styles.brandDescriptor}>VISUAL GOAL SETTING</Text>
            {!compactHero ? <Text style={styles.supportingCopy}>Make room for what matters.</Text> : null}
          </Animated.View>
          <Terrain />
        </View>

        <Animated.View layout={LinearTransition.duration(AnchorMotion.duration.standard)} style={styles.inkRegion}>
          <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel="Authentication mode">
            <Animated.View style={[styles.segmentIndicator, indicatorStyle]} />
            <Segment label="Sign in" selected={mode === 'signin'} onPress={() => switchMode('signin')} />
            <Segment label="Create account" selected={mode === 'create'} onPress={() => switchMode('create')} />
          </View>

          <Text accessibilityLiveRegion="polite" style={styles.formIntro}>
            {mode === 'signin' ? 'Welcome back.' : 'Keep your first Anchor with you.'}
          </Text>

          {mode === 'create' ? (
            <Animated.View entering={FadeInDown.duration(240)} exiting={FadeOutUp.duration(160)} style={styles.fieldGroup}>
              <Field icon={<UserRound size={18} color={colors.ink.text.secondary} />} label="Name (optional)" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
            </Animated.View>
          ) : null}
          <View style={styles.fieldGroup}>
            <Field ref={emailRef} icon={<Mail size={18} color={colors.ink.text.secondary} />} label="Email" value={email} onChangeText={(value) => { setEmail(value); setError(null); }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
            <Field ref={passwordRef} icon={<LockKeyhole size={18} color={colors.ink.text.secondary} />} label="Password" value={password} onChangeText={(value) => { setPassword(value); setError(null); }} secureTextEntry={!passwordVisible} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} textContentType={mode === 'signin' ? 'password' : 'newPassword'} returnKeyType="go" onSubmitEditing={submit} trailing={<Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} accessibilityState={{ selected: passwordVisible }} hitSlop={8} onPress={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={20} color={colors.ink.text.secondary} /> : <Eye size={20} color={colors.ink.text.secondary} />}</Pressable>} />
          </View>

          {mode === 'create' ? <Text style={styles.requirement}>At least 8 characters</Text> : <Pressable disabled={loading} onPress={() => void sendReset()} accessibilityRole="button" style={styles.forgot}><Text style={styles.forgotText}>Forgot password?</Text></Pressable>}
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}

          <V2Button testID="v2-auth-submit" size="large" loading={loading} onPress={submit} style={styles.primaryAction} accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}>{mode === 'signin' ? 'Sign in' : 'Create account'}</V2Button>
          <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or continue with</Text><View style={styles.dividerLine} /></View>
          <V2Button variant="secondary" loading={loading} onPress={() => socialSignIn('google')} style={styles.socialButton}>Continue with Google</V2Button>
          {appleAvailable ? <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={24} style={styles.appleButton} onPress={() => socialSignIn('apple')} /> : null}
          <Text style={styles.legal}>By continuing, you agree to our <Text style={styles.legalLink}>Terms</Text> and <Text style={styles.legalLink}>Privacy Policy</Text>.</Text>
        </Animated.View>
      </V2Screen>
    </View>
  );
}

const Field = React.forwardRef<TextInput, React.ComponentProps<typeof TextInput> & { icon: React.ReactNode; label: string; trailing?: React.ReactNode }>(function Field({ icon, label, trailing, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return <View style={[styles.field, focused && styles.fieldFocused]}><View style={styles.fieldIcon}>{icon}</View><TextInput ref={ref} placeholder={label} placeholderTextColor={colors.ink.text.secondary} accessibilityLabel={label} style={styles.fieldInput} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} {...props} />{trailing ? <View style={styles.fieldTrailing}>{trailing}</View> : null}</View>;
});

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} style={styles.segment}><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text></Pressable>;
}

function Terrain() {
  return <View pointerEvents="none" style={styles.terrain}><View style={styles.ridgeFar} /><View style={styles.ridgeNear} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink.base },
  scrollContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, flexGrow: 1 },
  hero: { minHeight: 294, backgroundColor: colors.canvas, paddingHorizontal: spacing[6], paddingTop: spacing[4], overflow: 'hidden' },
  heroCompact: { minHeight: 208 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  brandBlock: { alignItems: 'center', marginTop: -14 },
  brandMark: { width: 76, height: 98, marginBottom: 6 },
  brandMarkCompact: { width: 55, height: 68, marginBottom: 2 },
  wordmark: { fontFamily: 'BricolageGrotesque-SemiBold', color: colors.text.primary, fontSize: 25, lineHeight: 29, letterSpacing: 2.2 },
  brandDescriptor: { ...typography.labelSM, color: colors.text.secondary, marginTop: 4, letterSpacing: 1.25 },
  supportingCopy: { ...typography.bodyMD, color: colors.text.secondary, marginTop: 18 },
  terrain: { position: 'absolute', height: 54, left: 0, right: 0, bottom: -1, overflow: 'hidden' },
  ridgeFar: { position: 'absolute', left: -22, right: -22, bottom: 13, height: 44, backgroundColor: '#D4D7D0', opacity: 0.75, transform: [{ rotate: '-3deg' }, { skewX: '-24deg' }] },
  ridgeNear: { position: 'absolute', left: -20, right: -20, bottom: -20, height: 54, backgroundColor: colors.ink.base, transform: [{ rotate: '2deg' }, { skewX: '22deg' }] },
  inkRegion: { flex: 1, backgroundColor: colors.ink.base, paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[7] },
  segmented: { height: 50, borderRadius: 25, borderWidth: 1, borderColor: colors.ink.hairlineStrong, flexDirection: 'row', overflow: 'hidden', position: 'relative', marginBottom: spacing[4] },
  segmentIndicator: { position: 'absolute', top: 3, bottom: 3, left: 3, width: '50%', borderRadius: 22, backgroundColor: colors.ink.raised },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segmentText: { ...typography.labelMD, color: colors.ink.text.secondary, textTransform: 'uppercase' },
  segmentTextSelected: { color: colors.ink.text.primary },
  formIntro: { ...typography.headingSM, color: colors.ink.text.primary, marginBottom: spacing[3] },
  fieldGroup: { gap: spacing[2], marginBottom: spacing[2] },
  field: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: colors.ink.hairlineStrong, backgroundColor: colors.ink.raised, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3] },
  fieldFocused: { borderColor: 'rgba(244, 246, 250, 0.64)' },
  fieldIcon: { width: 28, alignItems: 'flex-start' },
  fieldInput: { flex: 1, minHeight: 52, color: colors.ink.text.primary, ...typography.bodyMD },
  fieldTrailing: { minWidth: 28, alignItems: 'flex-end' },
  requirement: { ...typography.caption, color: colors.ink.text.secondary, marginBottom: spacing[3] },
  forgot: { alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', marginBottom: spacing[2] },
  forgotText: { ...typography.labelMD, color: colors.ink.text.primary, textDecorationLine: 'underline' },
  error: { ...typography.bodySM, color: '#FFAAA6', marginBottom: spacing[3] },
  primaryAction: { marginTop: spacing[1], backgroundColor: colors.surface, borderColor: colors.surface },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginVertical: spacing[4] },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.ink.hairlineStrong },
  dividerText: { ...typography.caption, color: colors.ink.text.secondary },
  socialButton: { borderColor: colors.ink.hairlineStrong, backgroundColor: colors.ink.raised, marginBottom: spacing[2] },
  appleButton: { width: '100%', height: 52, marginBottom: spacing[5] },
  legal: { ...typography.caption, color: colors.ink.text.secondary, textAlign: 'center', marginTop: spacing[5], paddingHorizontal: spacing[4] },
  legalLink: { color: colors.ink.text.primary, textDecorationLine: 'underline' },
});
