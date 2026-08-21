/**
 * Anchor App - Sign Up Screen
 *
 * The 'SignUp' route shares LoginScreen's Anchor 1.5 auth implementation
 * (tabs, providers, form, CTA) instead of maintaining a second, visually
 * different sign-up surface. This wrapper only fixes the default tab.
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

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ navigation, route }) => (
  <LoginScreen
    navigation={navigation}
    route={{ params: { initialTab: 'signup', ...route?.params } }}
  />
);

export default SignUpScreen;
