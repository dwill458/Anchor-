/**
 * LogoBreathScreen
 *
 * First screen shown to new users - a brief, calming breath before onboarding.
 * Duration: 500ms total.
 *
 * This is not a splash screen - it's a psychological threshold that prepares
 * the user for focus without interrupting with branding or instructions.
 */

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { OnboardingStackParamList } from '@/types';
import { LogoBreath } from '@/components/common';

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'LogoBreath'>;

export const LogoBreathScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();

    const handleComplete = () => {
        navigation.replace('Welcome');
    };

    return <LogoBreath onComplete={handleComplete} />;
};
