/**
 * Anchor App - Login Screen
 *
 * Email/password login with Google Sign-In option
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography } from '@/theme';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const { setUser, setToken } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle email/password sign in
   */
  const handleEmailSignIn = async (): Promise<void> => {
    // Validation
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const result = await AuthService.signInWithEmail(email.trim(), password);

      // Update global state
      setUser(result.user);
      setToken(result.token);

      // Navigate based on whether user is new or returning
      if (result.isNewUser) {
        // @ts-expect-error - Navigation types will be set up later
        navigation.navigate('Onboarding');
      } else {
        // @ts-expect-error - Navigation types will be set up later
        navigation.navigate('Main');
      }
    } catch (error) {
      Alert.alert('Sign In Failed', (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google Sign-In
   */
  const handleGoogleSignIn = async (): Promise<void> => {
    setIsLoading(true);

    try {
      const result = await AuthService.signInWithGoogle();

      // Update global state
      setUser(result.user);
      setToken(result.token);

      // Navigate based on whether user is new or returning
      if (result.isNewUser) {
        // @ts-expect-error - Navigation types will be set up later
        navigation.navigate('Onboarding');
      } else {
        // @ts-expect-error - Navigation types will be set up later
        navigation.navigate('Main');
      }
    } catch (error) {
      Alert.alert('Sign In Failed', (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Navigate to sign-up screen
   */
  const handleNavigateToSignUp = (): void => {
    // @ts-expect-error - Navigation types will be set up later
    navigation.navigate('SignUp');
  };

  /**
   * Handle forgot password
   */
  const handleForgotPassword = async (): Promise<void> => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address first');
      return;
    }

    try {
      await AuthService.sendPasswordResetEmail(email.trim());
      Alert.alert('Email Sent', 'Check your email for password reset instructions');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>Anchor</Text>
            <Text style={styles.subtitle}>Transform intentions into power</Text>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleEmailSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.charcoal} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In Button */}
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={handleNavigateToSignUp} disabled={isLoading}>
              <Text style={styles.linkText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: typography.sizes.h1,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background.card,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.navy,
  },
  forgotPassword: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    textAlign: 'right',
    marginBottom: spacing.lg,
  },
  button: {
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    marginBottom: spacing.lg,
  },
  primaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.navy,
  },
  dividerText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginHorizontal: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  linkText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
});
