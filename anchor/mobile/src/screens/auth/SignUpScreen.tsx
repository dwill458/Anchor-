/**
 * Anchor App - Sign Up Screen
 * Delegates to LoginScreen with initialTab="signup" to maintain exact HTML spec parity.
 */

import React from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import { LoginScreen } from './LoginScreen';
import type { AuthScreenParams, RootStackParamList } from '@/types';

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SignUp'>;

interface SignUpScreenProps {
  navigation: SignUpScreenNavigationProp;
  route?: { params?: AuthScreenParams };
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation, route }) => {
  const mergedRoute = {
    ...route,
    params: {
      ...route?.params,
      initialTab: 'signup' as const,
    },
  };

  return <LoginScreen navigation={navigation as any} route={mergedRoute} />;
};

export default SignUpScreen;
