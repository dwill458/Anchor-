/**
 * Anchor App - Login Screen (Optimized for Android)
 */

import React, { useState } from 'react';
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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography } from '@/theme';
import { useAuthStore } from '../../stores/authStore';
import { AuthService } from '@/services/AuthService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Onboarding: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { setAuthenticated, setHasCompletedOnboarding, setUser, setToken } = useAuthStore();

  // Simple fade-in only for better performance
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      const result = await AuthService.signInWithEmail(email.trim(), password);
      setUser(result.user);
      setToken(result.token);
      setAuthenticated(true);
      setHasCompletedOnboarding(true);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithApple();
      setUser(result.user);
      setToken(result.token);
      setAuthenticated(true);
      setHasCompletedOnboarding(true);
    } catch (err: any) {
      setError(err.message || 'Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithGoogle();
      setUser(result.user);
      setToken(result.token);
      setAuthenticated(true);
      setHasCompletedOnboarding(true);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

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
                <Text style={styles.title}>Anchor</Text>
                <Text style={styles.subtitle}>Transform intentions into power</Text>
              </View>

              <View style={[styles.card, Platform.OS === 'android' && styles.androidCard]}>
                {Platform.OS === 'ios' && (
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                )}
                <View style={styles.cardInner}>
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

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                    <LinearGradient colors={[colors.gold, '#B8941F']} style={styles.buttonGradient}>
                      {loading ? <ActivityIndicator color={colors.charcoal} /> : <Text style={styles.buttonText}>Sign In</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                    <Text style={styles.socialIcon}>G</Text>
                    <Text style={styles.socialText}>Continue with Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
                    <Text style={styles.socialIcon}>🍎</Text>
                    <Text style={styles.socialText}>Continue with Apple</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                  <Text style={styles.footerLink}>Sign Up</Text>
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
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 80, marginBottom: 10 },
  title: { fontSize: 40, fontFamily: typography.fonts.heading, color: colors.gold, letterSpacing: 2 },
  subtitle: { fontSize: 16, color: colors.silver, textAlign: 'center' },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  androidCard: { backgroundColor: 'rgba(26, 26, 29, 0.95)' },
  cardInner: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { color: colors.bone, marginBottom: 8, fontSize: 14, fontWeight: '600' },
  input: { height: 56, backgroundColor: 'rgba(15, 20, 25, 0.5)', borderRadius: 12, paddingHorizontal: 16, color: colors.bone, borderWidth: 2, borderColor: 'rgba(192, 192, 192, 0.2)' },
  inputFocused: { borderColor: colors.gold },
  errorText: { color: colors.error, textAlign: 'center', marginBottom: 16 },
  button: { borderRadius: 12, overflow: 'hidden', marginTop: 10 },
  buttonGradient: { height: 56, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.charcoal, fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(192, 192, 192, 0.2)' },
  dividerText: { color: colors.silver, marginHorizontal: 16 },
  socialButton: { height: 56, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(192, 192, 192, 0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  socialIcon: { fontSize: 20, color: colors.bone, marginRight: 10, fontWeight: '700' },
  socialText: { color: colors.bone, fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { color: colors.silver, fontSize: 16 },
  footerLink: { color: colors.gold, fontWeight: '700', fontSize: 16 },
});

export default LoginScreen;
