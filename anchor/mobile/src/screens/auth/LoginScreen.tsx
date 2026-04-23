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
import { colors, typography } from '@/theme';
import { useAuthStore } from '../../stores/authStore';
import { AuthService } from '../../services/AuthService';
import PostAuthFlowService from '../../services/PostAuthFlowService';
import type { AuthScreenParams, OnboardingStackParamList, RootStackParamList } from '@/types';

type SharedAuthParamList = RootStackParamList & OnboardingStackParamList;
type AuthTab = 'signin' | 'signup';
type FocusedField = 'name' | 'email' | 'password' | 'confirmPassword' | null;

type LoginScreenNavigationProp = StackNavigationProp<SharedAuthParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
  route?: { params?: AuthScreenParams };
}

const ANCHOR_GOLD = require('../../assets/images/anchor-gold.png');

const AppleIcon = () => (
  <Text style={styles.ssoIcon}>Apple</Text>
);

const GoogleIcon = () => (
  <View style={styles.googleIconWrap}>
    <View style={[styles.googleIconDot, { backgroundColor: '#4285F4' }]} />
    <View style={[styles.googleIconDot, { backgroundColor: '#EA4335' }]} />
    <View style={[styles.googleIconDot, { backgroundColor: '#FBBC05' }]} />
    <View style={[styles.googleIconDot, { backgroundColor: '#34A853' }]} />
  </View>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, route }) => {
  const [tab, setTab] = useState<AuthTab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const context = route?.params?.context;

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

  const resetError = () => {
    if (error) {
      setError('');
    }
  };

  const completeAuth = async (result: Awaited<ReturnType<typeof AuthService.signInWithEmail>>) => {
    await PostAuthFlowService.run({
      user: result.user,
      token: result.token,
      preserveCompletedOnboarding:
        hasCompletedOnboarding || context === 'first_anchor_gate',
      launchTrialPurchase: false,
    });

    if (context === 'first_anchor_gate') {
      navigation.replace('FirstAnchorAccountGate');
    }
  };

  const handleLogin = async () => {
    resetError();
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.signInWithEmail(email, password, {
        hasCompletedOnboarding: context === 'first_anchor_gate' ? true : undefined,
      });
      await completeAuth(result);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
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
        hasCompletedOnboarding: context === 'first_anchor_gate' ? true : undefined,
      });
      await completeAuth(result);
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
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
    if (!email.trim()) {
      setError('Enter your email first to reset your password');
      return;
    }

    setLoading(true);
    try {
      await AuthService.sendPasswordResetEmail(email);
      Alert.alert('Reset email sent', `A reset link was sent to ${email.trim()}.`);
    } catch (err: any) {
      setError(err.message || 'Unable to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    resetError();
    setLoading(true);
    void (async () => {
      try {
        const result = await AuthService.signInWithApple();
        await completeAuth(result);
      } catch (err: any) {
        const message = err?.message || 'Apple sign-in failed';
        setError(message);
        Alert.alert('Apple sign-in', message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleGoogleSignIn = () => {
    resetError();
    setLoading(true);
    void (async () => {
      try {
        const result = await AuthService.signInWithGoogle();
        await completeAuth(result);
      } catch (err: any) {
        const message = err?.message || 'Google sign-in failed';
        setError(message);
        Alert.alert('Google sign-in', message);
      } finally {
        setLoading(false);
      }
    })();
  };

  const isSignIn = tab === 'signin';
  const ctaCopy = isSignIn ? 'ENTER THE SANCTUARY' : 'FORGE YOUR PATH';

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
                  <TouchableOpacity style={styles.ssoButton} onPress={handleAppleSignIn} activeOpacity={0.85}>
                    <AppleIcon />
                    <Text style={styles.ssoText}>APPLE</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.ssoButton} onPress={handleGoogleSignIn} activeOpacity={0.85}>
                    <GoogleIcon />
                    <Text style={styles.ssoText}>GOOGLE</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with email</Text>
                  <View style={styles.dividerLine} />
                </View>

                {!isSignIn
                  ? renderField('name', 'FULL NAME', name, setName, {
                    autoCapitalize: 'words',
                    placeholder: 'Your name',
                  })
                  : null}

                {renderField('email', 'EMAIL', email, setEmail, {
                  keyboardType: 'email-address',
                  placeholder: 'you@example.com',
                })}

                {renderField('password', 'PASSWORD', password, setPassword, {
                  placeholder: '••••••••',
                  secureTextEntry: true,
                  showToggle: true,
                  shown: showPassword,
                  onToggle: () => setShowPassword((current) => !current),
                })}

                {!isSignIn
                  ? renderField('confirmPassword', 'CONFIRM PASSWORD', confirmPassword, setConfirmPassword, {
                    placeholder: '••••••••',
                    secureTextEntry: true,
                    showToggle: true,
                    shown: showConfirmPassword,
                    onToggle: () => setShowConfirmPassword((current) => !current),
                  })
                  : null}

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
  ssoButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(8,12,16,0.7)',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
  },
  ssoIcon: {
    color: colors.bone,
    fontFamily: typography.fonts.bodyBold,
    fontSize: 12,
  },
  ssoText: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(245,245,220,0.78)',
  },
  googleIconWrap: {
    width: 16,
    height: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  googleIconDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
